import type { Response } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../../middleware/auth.middleware.js';
import * as storageService from './storage.service.js';

const routingModes = ['most_available', 'round_robin', 'priority'] as const;
const routingPolicySchema = z.object({
  mode: z.enum(routingModes),
  priorityAccountIds: z.array(z.string().min(1)).max(100).optional(),
});

export async function getSummary(_req: AuthRequest, res: Response) {
  const summary = await storageService.getStorageSummary();
  return res.json(summary);
}

export async function getRoutingPolicy(req: AuthRequest, res: Response) {
  const policy = await storageService.getRoutingPolicy(req.user!.id);
  return res.json({ policy });
}

export async function updateRoutingPolicy(req: AuthRequest, res: Response) {
  const body = routingPolicySchema.parse(req.body);
  const policy = await storageService.updateRoutingPolicy(req.user!.id, body);
  return res.json({ policy });
}

export async function getBreakdown(_req: AuthRequest, res: Response) {
  const breakdown = await storageService.getStorageBreakdown();
  return res.json(breakdown);
}
