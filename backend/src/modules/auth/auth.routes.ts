import { Router } from 'express';
import { google } from 'googleapis';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { requireAuth, type AuthRequest } from '../../middleware/auth.middleware.js';
import { credentialsLimiter, refreshLimiter } from '../../middleware/rate-limit.middleware.js';
import { verifyPassword } from '../../utils/password.js';
import { encryptText, hashToken, randomToken } from '../../utils/crypto.js';
import { signAccessToken } from '../../utils/jwt.js';
import { createOAuthClient, syncGoogleQuota } from '../google/google.service.js';
import { normalizeEmail } from '../../utils/email.js';

export const authRouter = Router();

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const refreshSchema = z.object({ refreshToken: z.string().min(1) });
const googleExchangeSchema = z.object({ token: z.string().min(1) });

async function createSession(userId: string, req: AuthRequest) {
  const refreshToken = randomToken();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  const session = await prisma.userSession.create({
    data: {
      userId,
      refreshTokenHash: hashToken(refreshToken),
      userAgent: req.header('User-Agent'),
      ipAddress: req.ip,
      expiresAt,
    },
  });
  return { accessToken: signAccessToken({ sub: userId, sid: session.id }), refreshToken };
}

authRouter.post('/login', credentialsLimiter, async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: normalizeEmail(body.email) } });
    if (!user || !(await verifyPassword(user.passwordHash, body.password)))
      return res
        .status(401)
        .json({ code: 'AUTH_INVALID_CREDENTIALS', message: 'Invalid email or password.' });
    if (user.status !== 'active')
      return res
        .status(403)
        .json({ code: 'ACCOUNT_DISABLED', message: 'This account has been disabled.' });
    const tokens = await createSession(user.id, req);
    return res.json({
      ...tokens,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    return next(error);
  }
});

authRouter.get('/google/url', credentialsLimiter, async (_req, res, next) => {
  try {
    const config = await prisma.providerConfig.findFirstOrThrow({
      where: { userId: null, provider: 'google_drive', status: 'active' },
      orderBy: { createdAt: 'desc' },
    });
    const state = randomToken();
    await prisma.oauthState.create({
      data: {
        providerConfigId: config.id,
        flow: 'login',
        stateHash: hashToken(state),
        expiresAt: new Date(Date.now() + 10 * 60_000),
      },
    });
    const client = createOAuthClient(config);
    const url = client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: true,
      scope: config.scopes as string[],
      state,
    });
    return res.json({ url });
  } catch (error) {
    return next(error);
  }
});

authRouter.get('/google/callback', async (req, res) => {
  try {
    const query = z.object({ code: z.string(), state: z.string() }).parse(req.query);
    const oauthState = await prisma.oauthState.findUniqueOrThrow({
      where: { stateHash: hashToken(query.state) },
      include: { providerConfig: true },
    });
    if (oauthState.flow !== 'login' || oauthState.usedAt || oauthState.expiresAt < new Date())
      return res.redirect(`${env.FRONTEND_URL}/google-auth?status=error`);

    const client = createOAuthClient(oauthState.providerConfig);
    const tokenResult = await client.getToken(query.code);
    const tokens = tokenResult.tokens;
    if (!tokens.access_token) return res.redirect(`${env.FRONTEND_URL}/google-auth?status=error`);
    client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const profile = await oauth2.userinfo.get();
    const providerAccountId = profile.data.id;
    if (!providerAccountId || !profile.data.email)
      return res.redirect(`${env.FRONTEND_URL}/google-auth?status=error`);
    // The email address is the only thing that maps this Google identity onto an Ithaca
    // account below, so an unverified one is an impersonation vector: a Google account can
    // be created against an arbitrary non-Gmail address, and `verified_email` is the only
    // evidence ownership was ever proven. Fail closed — v2 userinfo always returns it.
    if (profile.data.verified_email !== true)
      return res.redirect(`${env.FRONTEND_URL}/google-auth?status=unverified_email`);
    const email = normalizeEmail(profile.data.email);

    // Registration is admin-only: Google login authenticates existing users, it never
    // provisions new ones. Without this the callback would hand a full workspace session
    // to any Google account that completes the consent flow.
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.redirect(`${env.FRONTEND_URL}/google-auth?status=unknown_account`);
    if (user.status !== 'active')
      return res.redirect(`${env.FRONTEND_URL}/google-auth?status=account_disabled`);
    const existingAccount = await prisma.connectedAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: 'google_drive',
          providerAccountId,
        },
      },
    });
    const refreshTokenEncrypted = tokens.refresh_token
      ? encryptText(tokens.refresh_token)
      : existingAccount?.refreshTokenEncrypted;
    if (!refreshTokenEncrypted) return res.redirect(`${env.FRONTEND_URL}/google-auth?status=error`);

    const account = await prisma.connectedAccount.upsert({
      where: {
        provider_providerAccountId: {
          provider: 'google_drive',
          providerAccountId,
        },
      },
      create: {
        userId: user.id,
        providerConfigId: oauthState.providerConfigId,
        provider: 'google_drive',
        providerAccountId,
        email,
        displayName: profile.data.name,
        avatarUrl: profile.data.picture,
        accessTokenEncrypted: encryptText(tokens.access_token),
        refreshTokenEncrypted,
        tokenExpiresAt: new Date(tokens.expiry_date ?? Date.now() + 3600_000),
        scopes: oauthState.providerConfig.scopes as string[],
        status: 'connected',
      },
      update: {
        providerConfigId: oauthState.providerConfigId,
        email,
        displayName: profile.data.name,
        avatarUrl: profile.data.picture,
        accessTokenEncrypted: encryptText(tokens.access_token),
        refreshTokenEncrypted,
        tokenExpiresAt: new Date(tokens.expiry_date ?? Date.now() + 3600_000),
        scopes: oauthState.providerConfig.scopes as string[],
        status: 'connected',
      },
    });

    await prisma.oauthState.update({
      where: { id: oauthState.id },
      data: { usedAt: new Date(), userId: user.id },
    });
    await syncGoogleQuota(account.id).catch(() => undefined);

    const handoffToken = randomToken();
    await prisma.authHandoff.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(handoffToken),
        expiresAt: new Date(Date.now() + 5 * 60_000),
      },
    });
    return res.redirect(`${env.FRONTEND_URL}/google-auth?token=${handoffToken}`);
  } catch (error) {
    logger.error({ err: error }, 'Google Auth callback failed');
    return res.redirect(`${env.FRONTEND_URL}/google-auth?status=error`);
  }
});

authRouter.post('/google/exchange', credentialsLimiter, async (req, res, next) => {
  try {
    const body = googleExchangeSchema.parse(req.body);
    const handoff = await prisma.authHandoff.findFirst({
      where: { tokenHash: hashToken(body.token), usedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
    if (!handoff)
      return res
        .status(401)
        .json({ code: 'AUTH_GOOGLE_HANDOFF_INVALID', message: 'Google login session expired.' });
    await prisma.authHandoff.update({ where: { id: handoff.id }, data: { usedAt: new Date() } });
    const tokens = await createSession(handoff.userId, req);
    return res.json({
      ...tokens,
      user: { id: handoff.user.id, name: handoff.user.name, email: handoff.user.email },
    });
  } catch (error) {
    return next(error);
  }
});

authRouter.post('/refresh', refreshLimiter, async (req, res, next) => {
  try {
    const body = refreshSchema.parse(req.body);
    const presentedHash = hashToken(body.refreshToken);
    const session = await prisma.userSession.findFirst({
      where: { refreshTokenHash: presentedHash, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: { select: { status: true } } },
    });
    if (!session)
      return res
        .status(401)
        .json({ code: 'AUTH_SESSION_EXPIRED', message: 'Refresh token expired.' });
    if (session.user.status !== 'active')
      return res
        .status(403)
        .json({ code: 'ACCOUNT_DISABLED', message: 'This account has been disabled.' });
    // Rotate on every use so a leaked token stops working as soon as either party refreshes.
    // The update is conditional on the hash we read: two concurrent refreshes with the same
    // token would otherwise both "succeed" and hand out two tokens, only one of which is
    // still stored. The loser gets a 401 and retries with the token it already holds.
    const refreshToken = randomToken();
    const rotated = await prisma.userSession.updateMany({
      where: { id: session.id, refreshTokenHash: presentedHash },
      data: { refreshTokenHash: hashToken(refreshToken) },
    });
    if (rotated.count === 0)
      return res
        .status(409)
        .json({ code: 'AUTH_REFRESH_RACE', message: 'Refresh already in progress. Retry.' });
    return res.json({
      accessToken: signAccessToken({ sub: session.userId, sid: session.id }),
      refreshToken,
    });
  } catch (error) {
    return next(error);
  }
});

authRouter.post('/logout', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await prisma.userSession.update({
      where: { id: req.user!.sessionId },
      data: { revokedAt: new Date() },
    });
    return res.json({ status: 'ok' });
  } catch (error) {
    return next(error);
  }
});

authRouter.get('/me', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.id },
      select: { id: true, name: true, email: true, status: true, role: true },
    });
    return res.json({ user });
  } catch (error) {
    return next(error);
  }
});
