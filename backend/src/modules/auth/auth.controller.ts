import type { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import type { AuthRequest } from '../../middleware/auth.middleware.js';
import * as authService from './auth.service.js';

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const refreshSchema = z.object({ refreshToken: z.string().min(1) });
const googleExchangeSchema = z.object({ token: z.string().min(1) });

export async function login(req: AuthRequest, res: Response) {
  const body = loginSchema.parse(req.body);
  const { tokens, user } = await authService.login(body.email, body.password, req);
  return res.json({ ...tokens, user });
}

export async function getGoogleUrl(_req: Request, res: Response) {
  const url = await authService.getGoogleLoginUrl();
  return res.json({ url });
}

export async function googleCallback(req: Request, res: Response) {
  try {
    const url = await authService.handleGoogleLoginCallback(req.query);
    return res.redirect(url);
  } catch (error) {
    logger.error({ err: error }, 'Google Auth callback failed');
    return res.redirect(`${env.FRONTEND_URL}/google-auth?status=error`);
  }
}

export async function exchangeGoogleHandoff(req: AuthRequest, res: Response) {
  const body = googleExchangeSchema.parse(req.body);
  const { tokens, user } = await authService.exchangeGoogleHandoff(body.token, req);
  return res.json({ ...tokens, user });
}

export async function refresh(req: Request, res: Response) {
  const body = refreshSchema.parse(req.body);
  const tokens = await authService.refreshSession(body.refreshToken);
  return res.json(tokens);
}

export async function logout(req: AuthRequest, res: Response) {
  await authService.logout(req.user!.sessionId);
  return res.json({ status: 'ok' });
}

export async function me(req: AuthRequest, res: Response) {
  const user = await authService.getProfile(req.user!.id);
  return res.json({ user });
}
