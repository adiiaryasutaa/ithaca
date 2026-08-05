import type { Response } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { emailSchema } from '../../utils/validation.js';
import * as inviteService from './invite.service.js';

const inviteSchema = z.object({
  email: emailSchema,
  role: z.enum(['viewer', 'editor']).default('viewer'),
  targetType: z.enum(['file', 'folder']),
  targetId: z.string().min(1),
});

export async function list(req: AuthRequest, res: Response) {
  const result = await inviteService.listInvites(req.user!.id);
  return res.json(result);
}

export async function create(req: AuthRequest, res: Response) {
  const body = inviteSchema.parse(req.body);
  const invite = await inviteService.createInvite(req.user!.id, body);
  return res.status(201).json({ invite });
}

export async function revoke(req: AuthRequest, res: Response) {
  await inviteService.revokeInvite(String(req.params.id));
  return res.json({ status: 'ok' });
}
