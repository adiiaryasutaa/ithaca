import type { Response } from 'express';
import type { ApiKeyRequest } from '../../middleware/api-key.middleware.js';
import { streamProviderFile } from '../files/stream-file.js';
import * as publicApiService from './public-api.service.js';

export async function listFiles(req: ApiKeyRequest, res: Response) {
  const files = await publicApiService.listFiles(req.apiKey!);
  return res.json({ files });
}

export async function downloadFile(req: ApiKeyRequest, res: Response) {
  const fileId = String(req.params.id);
  const file = await publicApiService.getFileForDownload(req.apiKey!, fileId);
  return streamProviderFile(file, req.headers.range, res, { disposition: 'attachment' });
}
