import type { Response } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../../middleware/auth.middleware.js';
import * as folderService from './folder.service.js';

const iconUrlSchema = z.string().url().startsWith('https://api.iconify.design/lucide:').max(2048);
const colorSchema = z
  .string()
  .regex(/^(#[0-9a-fA-F]{6}|text-[a-z]+-[0-9]+)$/)
  .max(64);

const createSchema = z.object({
  name: z.string().min(1).max(255),
  color: colorSchema.optional(),
  iconUrl: iconUrlSchema.nullable().optional(),
  parentId: z.string().nullable().optional(),
});

const listQuerySchema = z.object({
  parentId: z.string().nullable().optional(),
  all: z.string().optional(),
});

export async function list(req: AuthRequest, res: Response) {
  const query = listQuerySchema.parse(req.query);
  const folders = await folderService.listFolders(query.parentId, query.all === '1');
  return res.json({ folders });
}

export async function recent(req: AuthRequest, res: Response) {
  const limit = Math.min(Number(req.query.limit ?? 4), 4);
  const folders = await folderService.listRecentFolders(limit);
  return res.json({ folders });
}

export async function create(req: AuthRequest, res: Response) {
  const body = createSchema.parse(req.body);
  const folder = await folderService.createFolder(req.user!.id, body);
  return res.status(201).json({ folder });
}

export async function update(req: AuthRequest, res: Response) {
  const body = createSchema.partial().parse(req.body);
  const folderId = String(req.params.id);
  const folder = await folderService.updateFolder(req.user!.id, folderId, body);
  return res.json({ folder });
}

export async function remove(req: AuthRequest, res: Response) {
  const folderId = String(req.params.id);
  await folderService.deleteFolder(req.user!.id, folderId);
  return res.json({ status: 'ok' });
}
