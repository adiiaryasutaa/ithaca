import type { Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../../config/logger.js';
import type { AuthRequest } from '../../middleware/auth.middleware.js';
import * as fileService from './file.service.js';
import { getProviderFileStream, streamProviderFile } from './stream-file.js';

const batchFileSchema = z.object({ fileIds: z.array(z.string().min(1)).min(1).max(100) });

const fileListQuerySchema = z.object({
  folderId: z.string().optional(),
  unfiled: z.enum(['1']).optional(),
  q: z.string().trim().max(255).optional(),
  kind: z.enum(['image', 'video', 'pdf', 'doc', 'archive']).optional(),
  accountId: z.string().optional(),
  minSize: z.coerce.number().optional(),
  maxSize: z.coerce.number().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const updateFileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  folderId: z.string().nullable().optional(),
});

export async function previewByToken(req: Request, res: Response) {
  const token = String(req.params.token);
  const file = await fileService.getFileByPreviewToken(token);
  return streamProviderFile(file, req.headers.range, res, { disposition: 'inline' });
}

export async function list(req: AuthRequest, res: Response) {
  const query = fileListQuerySchema.parse(req.query);
  const files = await fileService.listFiles(query);
  return res.json({ files });
}

export async function moveBatch(req: AuthRequest, res: Response) {
  const body = batchFileSchema
    .extend({ folderId: z.string().nullable().optional() })
    .parse(req.body);
  const moved = await fileService.moveFilesBatch(req.user!.id, body.fileIds, body.folderId);
  return res.json({ status: 'ok', moved });
}

export async function trashBatch(req: AuthRequest, res: Response) {
  const body = batchFileSchema.parse(req.body);
  const deleted = await fileService.trashFilesBatch(req.user!.id, body.fileIds);
  return res.json({ status: 'ok', deleted });
}

export async function listTrash(req: AuthRequest, res: Response) {
  const query = z.object({ q: z.string().trim().max(255).optional() }).parse(req.query);
  const files = await fileService.listTrashedFiles(query);
  return res.json({ files });
}

export async function restoreBatch(req: AuthRequest, res: Response) {
  const body = batchFileSchema.parse(req.body);
  const restored = await fileService.restoreFilesBatch(req.user!.id, body.fileIds);
  return res.json({ status: 'ok', restored });
}

export async function permanentDeleteBatch(req: AuthRequest, res: Response) {
  const body = batchFileSchema.parse(req.body);
  const result = await fileService.permanentlyDeleteFilesBatch(req.user!.id, body.fileIds);
  if (result.deleted === 0 && result.failed.length > 0) {
    return res.status(400).json({
      code: 'FILES_DELETE_FAILED',
      message: 'No files were permanently deleted.',
      deleted: 0,
      failed: result.failed,
    });
  }
  return res.json({ status: 'ok', deleted: result.deleted, failed: result.failed });
}

export async function sharedLinks(_req: AuthRequest, res: Response) {
  const shares = await fileService.listSharedLinks();
  return res.json({ shares });
}

export async function syncGoogle(req: AuthRequest, res: Response) {
  const body = z
    .object({ connectedAccountId: z.string().min(1).optional() })
    .parse(req.body ?? {});
  const results = await fileService.syncGoogleAccounts(req.user!.id, body.connectedAccountId);
  return res.json({ status: 'ok', results });
}

export async function getById(req: AuthRequest, res: Response) {
  const fileId = String(req.params.id);
  const file = await fileService.getFileById(fileId);
  return res.json({ file: fileService.toFileResponse(file) });
}

export async function update(req: AuthRequest, res: Response) {
  const body = updateFileSchema.parse(req.body);
  const fileId = String(req.params.id);
  const updated = await fileService.updateFile(req.user!.id, fileId, body);
  return res.json({ file: fileService.toFileResponse(updated) });
}

export async function createShare(req: AuthRequest, res: Response) {
  const fileId = String(req.params.id);
  const result = await fileService.createOrGetShare(req.user!.id, fileId);
  return res.status(result.created ? 201 : 200).json({ url: result.url, shareId: result.shareId });
}

export async function makePublic(req: AuthRequest, res: Response) {
  try {
    const fileId = String(req.params.id);
    const file = await fileService.getFileWithAccount(fileId);
    if (file.provider !== 'google_drive') {
      return res.status(400).json({
        code: 'UNSUPPORTED_PROVIDER',
        message: 'Only Google Drive files can be made public.',
      });
    }
    const url = await fileService.makeGoogleFileWebPublic(file);
    return res.json({ status: 'ok', url });
  } catch (error: any) {
    return res.status(500).json({
      code: 'GOOGLE_API_ERROR',
      message: error.message || 'Failed to update Google Drive permissions.',
    });
  }
}

export async function deleteShare(req: AuthRequest, res: Response) {
  const fileId = String(req.params.id);
  await fileService.revokeShare(fileId);
  return res.json({ status: 'ok' });
}

export async function createPreviewToken(req: AuthRequest, res: Response) {
  const fileId = String(req.params.id);
  const { path } = await fileService.createPreviewToken(req.user!.id, fileId);
  return res.status(201).json({ path, url: `${req.protocol}://${req.get('host')}${path}` });
}

export async function getViewUrl(req: AuthRequest, res: Response) {
  const fileId = String(req.params.id);
  const url = await fileService.getViewUrl(fileId);
  return res.json({ url });
}

export async function download(req: AuthRequest, res: Response) {
  const fileId = String(req.params.id);
  const file = await fileService.getFileWithAccount(fileId);
  return streamProviderFile(file, req.headers.range, res, { disposition: 'attachment' });
}

export async function remove(req: AuthRequest, res: Response) {
  const fileId = String(req.params.id);
  await fileService.trashFile(req.user!.id, fileId);
  return res.json({ status: 'ok' });
}

export async function batchDownload(req: AuthRequest, res: Response) {
  const body = batchFileSchema.parse(req.body);
  const files = await fileService.getFilesForBatchDownload(body.fileIds);

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="ithaca-download.zip"');

  const { ZipArchive } = await import('archiver');
  const archive = new ZipArchive({ zlib: { level: 9 } });
  archive.on('error', (err: any) => {
    throw err;
  });
  archive.pipe(res);

  for (const file of files) {
    try {
      const result = await getProviderFileStream(file);
      if (!result) continue;
      archive.append(result.stream, { name: result.fileName });
    } catch (err) {
      logger.error({ err, fileName: file.name }, 'Failed to add file to zip');
    }
  }

  await archive.finalize();
}
