import { z } from 'zod';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { encryptText, hashToken, randomToken } from '../../utils/crypto.js';
import {
  createGoogleAuthUrl,
  exchangeGoogleOAuthCode,
  syncGoogleQuota,
} from '../google/google.service.js';
import {
  createAuthHandoff as createAuthHandoffRow,
  findGoogleConnectedAccountByProviderAccountId,
  findOAuthStateByHash,
  markOAuthStateUsed,
  upsertGoogleConnectedAccount,
} from '../google/google.repository.js';
import { connectS3Account, type ConnectS3AccountInput } from '../s3/s3.service.js';
import { serializeStorageAccount } from '../storage/storage.service.js';
import { syncQuotaForAccount } from '../storage/quota-sync.service.js';
import * as connectedAccountRepository from './connected-account.repository.js';

export async function listConnectedAccounts() {
  const accounts = await connectedAccountRepository.findConnectedAccountsWithStorageOrdered();
  const missingQuota = accounts.filter((account) => !account.storageAccount?.lastSyncedAt);
  for (const account of missingQuota) await syncQuotaForAccount(account).catch(() => undefined);

  const syncedAccounts =
    missingQuota.length > 0
      ? await connectedAccountRepository.findConnectedAccountsWithStorageOrdered()
      : accounts;

  return syncedAccounts.map(
    ({ accessTokenEncrypted: _a, refreshTokenEncrypted: _r, storageAccount, ...account }) => ({
      ...account,
      storageAccount: serializeStorageAccount(storageAccount),
    }),
  );
}

export async function createGoogleConnectUrl(userId: string, providerConfigId?: string) {
  const config = providerConfigId
    ? await connectedAccountRepository.findGoogleProviderConfigById(providerConfigId)
    : await connectedAccountRepository.findActiveGlobalGoogleProviderConfig();
  return createGoogleAuthUrl({ config, flow: 'connect', userId });
}

export async function connectS3(userId: string, input: ConnectS3AccountInput) {
  const { account, storageAccount } = await connectS3Account(userId, input);
  return { account: { ...account, storageAccount: serializeStorageAccount(storageAccount) } };
}

const googleCallbackQuerySchema = z.object({ code: z.string(), state: z.string() });

export type GoogleConnectCallbackResult =
  | { kind: 'redirect'; url: string }
  | { kind: 'json'; status: number; body: { code: string; message: string } };

/**
 * Handles BOTH the login flow (an unauthenticated user completing "Sign in with
 * Google") and the connect flow (an authenticated user linking an additional Drive
 * account), distinguished by `oauthState.flow`. These are genuinely different
 * policies — login auto-provisions a User row with no email-verification check,
 * unlike auth.service.ts's handleGoogleLoginCallback which requires an existing,
 * verified-email user. That asymmetry is a pre-existing inconsistency, preserved
 * here deliberately rather than harmonized.
 */
export async function handleGoogleConnectCallback(
  rawQuery: unknown,
): Promise<GoogleConnectCallbackResult> {
  const query = googleCallbackQuerySchema.parse(rawQuery);
  const oauthState = await findOAuthStateByHash(hashToken(query.state));
  if (oauthState.usedAt || oauthState.expiresAt < new Date())
    return {
      kind: 'json',
      status: 400,
      body: { code: 'GOOGLE_OAUTH_STATE_INVALID', message: 'OAuth state expired.' },
    };

  const { tokens, profile } = await exchangeGoogleOAuthCode(oauthState.providerConfig, query.code);
  if (!tokens.access_token)
    return {
      kind: 'json',
      status: 400,
      body: { code: 'GOOGLE_OAUTH_FAILED', message: 'Google did not return required tokens.' },
    };

  const providerAccountId = profile.providerAccountId;
  const email = profile.email;
  if (!providerAccountId || !email)
    return {
      kind: 'json',
      status: 400,
      body: { code: 'GOOGLE_PROFILE_FAILED', message: 'Google profile missing id or email.' },
    };

  if (oauthState.flow === 'login') {
    const name = profile.name || email.split('@')[0] || 'Google User';
    const user = await connectedAccountRepository.upsertUserByEmail(email, name);
    const existingAccount = await findGoogleConnectedAccountByProviderAccountId(providerAccountId);
    const refreshTokenEncrypted = tokens.refresh_token
      ? encryptText(tokens.refresh_token)
      : existingAccount?.refreshTokenEncrypted;
    if (!refreshTokenEncrypted) {
      logger.error(
        { hasRefreshToken: !!tokens.refresh_token },
        'Google login failed: no refresh token received and no existing account',
      );
      return { kind: 'redirect', url: `${env.FRONTEND_URL}/google-auth?status=error` };
    }
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
    return { kind: 'redirect', url: `${env.FRONTEND_URL}/google-auth?token=${handoffToken}` };
  }

  if (oauthState.flow !== 'connect' || !oauthState.userId)
    return {
      kind: 'json',
      status: 400,
      body: { code: 'GOOGLE_OAUTH_STATE_INVALID', message: 'OAuth state expired.' },
    };

  const existingAccount = await findGoogleConnectedAccountByProviderAccountId(providerAccountId);
  const refreshTokenEncrypted = tokens.refresh_token
    ? encryptText(tokens.refresh_token)
    : existingAccount?.refreshTokenEncrypted;
  if (!refreshTokenEncrypted)
    return {
      kind: 'json',
      status: 400,
      body: { code: 'GOOGLE_OAUTH_FAILED', message: 'Google did not return required tokens.' },
    };

  const account = await upsertGoogleConnectedAccount({
    userId: oauthState.userId,
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
  await markOAuthStateUsed(oauthState.id);
  await syncGoogleQuota(account.id);
  return { kind: 'redirect', url: `${env.FRONTEND_URL}/google-connected?status=success` };
}

export async function syncAccountQuota(accountId: string) {
  const account = await connectedAccountRepository.findConnectedAccountByIdOrThrow(accountId);
  const quota = await syncQuotaForAccount(account);
  return serializeStorageAccount(quota);
}

export async function disconnectAccount(accountId: string) {
  await connectedAccountRepository.disconnectAccount(accountId);
}
