import type { Request, Response } from 'express';
import { streamProviderFile } from '../files/stream-file.js';
import * as publicService from './public.service.js';

export async function getSharedFileMetadata(req: Request, res: Response) {
  const file = await publicService.getSharedFile(String(req.params.token));
  return res.json({ file: publicService.toSharedFileMetadata(file) });
}

export async function downloadSharedFile(req: Request, res: Response) {
  const file = await publicService.getSharedFile(String(req.params.token));
  return streamProviderFile(file, req.headers.range, res, { disposition: 'attachment' });
}

export async function previewSharedFile(req: Request, res: Response) {
  const file = await publicService.getSharedFile(String(req.params.token));
  return streamProviderFile(file, req.headers.range, res, { disposition: 'inline' });
}
