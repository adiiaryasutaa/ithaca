import { z } from 'zod';
import { env } from '../../config/env.js';
import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { encryptText, hashToken, randomToken } from '../../utils/crypto.js';
import { normalizeEmail } from '../../utils/email.js';
import { HttpError } from '../../utils/http-error.js';
import { verifyPassword } from '../../utils/password.js';
import { signAccessToken } from '../../utils/jwt.js';
import {
  createGoogleAuthUrl,
  exchangeGoogleOAuthCode,
  syncGoogleQuota,
} from '../google/google.service.js';
import {
  findGoogleConnectedAccountByProviderAccountId,
  findOAuthStateByHash,
  markOAuthStateUsed,
  upsertGoogleConnectedAccount,
  createAuthHandoff as createAuthHandoffRow,
} from '../google/google.repository.js';
import * as authRepository from './auth.repository.js';

export async function createSession(userId: string, req: AuthRequest) {
  const refreshToken = randomToken();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  const session = await authRepository.createUserSession(
    userId,
    hashToken(refreshToken),
    expiresAt,
    req,
  );
  return { accessToken: signAccessToken({ sub: userId, sid: session.id }), refreshToken };
}

export async function login(email: string, password: string, req: AuthRequest) {
  const user = await authRepository.findUserByEmail(normalizeEmail(email));
  if (!user || !(await verifyPassword(user.passwordHash, password)))
    throw new HttpError(401, 'AUTH_INVALID_CREDENTIALS', 'Invalid email or password.');
  if (user.status !== 'active')
    throw new HttpError(403, 'ACCOUNT_DISABLED', 'This account has been disabled.');
  const tokens = await createSession(user.id, req);
  return { tokens, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}

export async function getGoogleLoginUrl() {
  const config = await authRepository.findActiveGlobalGoogleProviderConfig();
  return createGoogleAuthUrl({ config, flow: 'login' });
}

const googleCallbackQuerySchema = z.object({ code: z.string(), state: z.string() });

/**
 * Returns the frontend redirect URL for every outcome — including business-rule
 * failures (invalid state, unverified email, unknown account, disabled account) —
 * so the controller's single catch block only ever has to handle truly unexpected
 * errors (network/DB/parse failures), matching the original handler's structure.
 */
export async function handleGoogleLoginCallback(rawQuery: unknown): Promise<string> {
  const query = googleCallbackQuerySchema.parse(rawQuery);
  const oauthState = await findOAuthStateByHash(hashToken(query.state));
  if (oauthState.flow !== 'login' || oauthState.usedAt || oauthState.expiresAt < new Date())
    return `${env.FRONTEND_URL}/google-auth?status=error`;

  const { tokens, profile } = await exchangeGoogleOAuthCode(oauthState.providerConfig, query.code);
  if (!tokens.access_token) return `${env.FRONTEND_URL}/google-auth?status=error`;

  const providerAccountId = profile.providerAccountId;
  if (!providerAccountId || !profile.email)
    return `${env.FRONTEND_URL}/google-auth?status=error`;
  // The email address is the only thing that maps this Google identity onto an Ithaca
  // account below, so an unverified one is an impersonation vector: a Google account can
  // be created against an arbitrary non-Gmail address, and `verified_email` is the only
  // evidence ownership was ever proven. Fail closed — v2 userinfo always returns it.
  if (profile.verifiedEmail !== true)
    return `${env.FRONTEND_URL}/google-auth?status=unverified_email`;
  const email = normalizeEmail(profile.email);

  // Registration is admin-only: Google login authenticates existing users, it never
  // provisions new ones. Without this the callback would hand a full workspace session
  // to any Google account that completes the consent flow.
  const user = await authRepository.findUserByEmail(email);
  if (!user) return `${env.FRONTEND_URL}/google-auth?status=unknown_account`;
  if (user.status !== 'active') return `${env.FRONTEND_URL}/google-auth?status=account_disabled`;

  const existingAccount = await findGoogleConnectedAccountByProviderAccountId(providerAccountId);
  const refreshTokenEncrypted = tokens.refresh_token
    ? encryptText(tokens.refresh_token)
    : existingAccount?.refreshTokenEncrypted;
  if (!refreshTokenEncrypted) return `${env.FRONTEND_URL}/google-auth?status=error`;

  const account = await upsertGoogleConnectedAccount({
    userId: user.id,
    providerConfigId: oauthState.providerConfigId,
    providerAccountId,
    email,
    displayName: profile.name,
    avatarUrl: profile.picture,
    accessToken: tokens.access_token,
    refreshTokenEncrypted,
    tokenExpiryDate: tokens.expiry_date,
    scopes: oauthState.providerConfig.scopes as string[],
  });

  await markOAuthStateUsed(oauthState.id, user.id);
  await syncGoogleQuota(account.id).catch(() => undefined);

  const handoffToken = randomToken();
  await createAuthHandoffRow(user.id, hashToken(handoffToken), new Date(Date.now() + 5 * 60_000));
  return `${env.FRONTEND_URL}/google-auth?token=${handoffToken}`;
}

export async function exchangeGoogleHandoff(token: string, req: AuthRequest) {
  const handoff = await authRepository.findValidAuthHandoff(hashToken(token));
  if (!handoff)
    throw new HttpError(401, 'AUTH_GOOGLE_HANDOFF_INVALID', 'Google login session expired.');
  await authRepository.markAuthHandoffUsed(handoff.id);
  const tokens = await createSession(handoff.userId, req);
  return { tokens, user: { id: handoff.user.id, name: handoff.user.name, email: handoff.user.email } };
}

export async function refreshSession(presentedRefreshToken: string) {
  const presentedHash = hashToken(presentedRefreshToken);
  const session = await authRepository.findActiveSessionByRefreshHash(presentedHash);
  if (!session) throw new HttpError(401, 'AUTH_SESSION_EXPIRED', 'Refresh token expired.');
  if (session.user.status !== 'active')
    throw new HttpError(403, 'ACCOUNT_DISABLED', 'This account has been disabled.');
  // Rotate on every use so a leaked token stops working as soon as either party refreshes.
  // The update is conditional on the hash we read: two concurrent refreshes with the same
  // token would otherwise both "succeed" and hand out two tokens, only one of which is
  // still stored. The loser gets a 401 and retries with the token it already holds.
  const refreshToken = randomToken();
  const rotated = await authRepository.rotateSessionRefreshToken(
    session.id,
    presentedHash,
    hashToken(refreshToken),
  );
  if (rotated.count === 0)
    throw new HttpError(409, 'AUTH_REFRESH_RACE', 'Refresh already in progress. Retry.');
  return {
    accessToken: signAccessToken({ sub: session.userId, sid: session.id }),
    refreshToken,
  };
}

export function logout(sessionId: string) {
  return authRepository.revokeSession(sessionId);
}

export function getProfile(userId: string) {
  return authRepository.findUserProfileById(userId);
}
