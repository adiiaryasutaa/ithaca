import type { Response } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../../middleware/auth.middleware.js';
import * as apiKeyService from './api-key.service.js';

const createSchema = z
  .object({
    name: z.string().trim().min(1).max(191),
    expiresAt: z.string().datetime().nullable().optional(),
    mode: z.enum(['upload', 'read']).default('upload'),
    targetFolderId: z.string().trim().min(1).nullable().optional(),
    targetFileId: z.string().trim().min(1).nullable().optional(),
  })
  .refine((data) => !(data.targetFolderId && data.targetFileId), {
    message: 'targetFolderId and targetFileId are mutually exclusive.',
    path: ['targetFileId'],
  })
  .refine((data) => !(data.mode === 'upload' && data.targetFileId), {
    message: 'Upload-mode keys cannot be pinned to a file.',
    path: ['targetFileId'],
  });

export async function list(_req: AuthRequest, res: Response) {
  const apiKeys = await apiKeyService.listApiKeys();
  return res.json({ apiKeys });
}

export async function create(req: AuthRequest, res: Response) {
  const body = createSchema.parse(req.body);
  const result = await apiKeyService.createApiKey(req.user!.id, body);
  return res.status(201).json(result);
}

export async function revoke(req: AuthRequest, res: Response) {
  await apiKeyService.revokeApiKey(String(req.params.id));
  return res.json({ status: 'ok' });
}
