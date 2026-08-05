import type { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import type { AuthRequest } from '../../middleware/auth.middleware.js';
import * as connectedAccountService from './connected-account.service.js';

const s3ConnectSchema = z.object({
  name: z.string().trim().min(1).max(191),
  bucket: z.string().trim().min(1).max(191),
  region: z.string().trim().min(1).max(191),
  endpoint: z.string().url().optional().or(z.literal('')),
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
  forcePathStyle: z.boolean().optional(),
  quotaBytes: z.string().regex(/^\d+$/).optional().nullable(),
});

const connectUrlQuerySchema = z.object({ providerConfigId: z.string().min(1).optional() });

export async function list(_req: AuthRequest, res: Response) {
  const accounts = await connectedAccountService.listConnectedAccounts();
  return res.json({ accounts });
}

export async function getGoogleConnectUrl(req: AuthRequest, res: Response) {
  const query = connectUrlQuerySchema.parse(req.query);
  const url = await connectedAccountService.createGoogleConnectUrl(
    req.user!.id,
    query.providerConfigId,
  );
  return res.json({ url });
}

export async function redirectToGoogleConnect(req: AuthRequest, res: Response) {
  const query = connectUrlQuerySchema.parse(req.query);
  const url = await connectedAccountService.createGoogleConnectUrl(
    req.user!.id,
    query.providerConfigId,
  );
  return res.redirect(url);
}

export async function connectS3(req: AuthRequest, res: Response) {
  const body = s3ConnectSchema.parse(req.body);
  const result = await connectedAccountService.connectS3(req.user!.id, body);
  return res.status(201).json(result);
}

export async function googleCallback(req: Request, res: Response) {
  try {
    const result = await connectedAccountService.handleGoogleConnectCallback(req.query);
    if (result.kind === 'redirect') return res.redirect(result.url);
    return res.status(result.status).json(result.body);
  } catch (error) {
    logger.error({ err: error }, 'Google OAuth callback failed');
    return res.redirect(`${env.FRONTEND_URL}/google-connected?status=error`);
  }
}

export async function syncQuota(req: AuthRequest, res: Response) {
  const accountId = String(req.params.id);
  const quota = await connectedAccountService.syncAccountQuota(accountId);
  return res.json({ quota });
}

export async function disconnect(req: AuthRequest, res: Response) {
  const accountId = String(req.params.id);
  await connectedAccountService.disconnectAccount(accountId);
  return res.json({ status: 'ok' });
}
