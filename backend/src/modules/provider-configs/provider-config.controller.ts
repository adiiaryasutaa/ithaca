import type { Response } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../../middleware/auth.middleware.js';
import * as providerConfigService from './provider-config.service.js';

const createSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUri: z.string().url(),
  scopes: z.array(z.string()).min(1),
});

export async function createGoogle(req: AuthRequest, res: Response) {
  const body = createSchema.parse(req.body);
  const config = await providerConfigService.createGoogleProviderConfig(req.user!.id, body);
  return res.status(201).json(config);
}

export async function list(_req: AuthRequest, res: Response) {
  const configs = await providerConfigService.listProviderConfigs();
  return res.json({ configs });
}

export async function remove(req: AuthRequest, res: Response) {
  await providerConfigService.deleteProviderConfig(String(req.params.id));
  return res.json({ status: 'ok' });
}
