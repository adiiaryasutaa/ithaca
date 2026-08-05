import type { Response } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { boundedEmailSchema } from '../../utils/validation.js';
import * as userService from './user.service.js';

const createSchema = z.object({
  name: z.string().trim().min(2).max(191),
  email: boundedEmailSchema,
  password: z.string().min(8),
  role: z.enum(['user', 'admin']).default('user'),
});

const updateSchema = z.object({
  name: z.string().trim().min(2).max(191).optional(),
  email: boundedEmailSchema.optional(),
  password: z.string().min(8).optional(),
  role: z.enum(['user', 'admin']).optional(),
  status: z.enum(['active', 'disabled']).optional(),
});

export async function list(_req: AuthRequest, res: Response) {
  const users = await userService.listUsers();
  return res.json({ users });
}

export async function getById(req: AuthRequest, res: Response) {
  const user = await userService.getUser(String(req.params.id));
  return res.json({ user });
}

export async function create(req: AuthRequest, res: Response) {
  const body = createSchema.parse(req.body);
  const user = await userService.createUser(req.user!.id, body);
  return res.status(201).json({ user });
}

export async function update(req: AuthRequest, res: Response) {
  const body = updateSchema.parse(req.body);
  const user = await userService.updateUser(req.user!.id, String(req.params.id), body);
  return res.json({ user });
}

export async function remove(req: AuthRequest, res: Response) {
  await userService.disableUser(req.user!.id, String(req.params.id));
  return res.json({ status: 'ok' });
}
