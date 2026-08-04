import { Router } from 'express';
import { requireApiKey, type ApiKeyRequest } from '../../middleware/api-key.middleware.js';
import { handleUpload } from '../uploads/upload.controller.js';
import { prisma } from '../../config/prisma.js';
import { streamProviderFile } from '../files/stream-file.js';

export const publicApiRouter = Router();

publicApiRouter.post('/v1/uploads', requireApiKey('files:upload'), handleUpload);

publicApiRouter.get(
  '/v1/files',
  requireApiKey('files:read'),
  async (req: ApiKeyRequest, res, next) => {
    try {
      const { targetFileId, targetFolderId } = req.apiKey!;

      if (targetFileId) {
        const file = await prisma.file.findFirst({
          where: { id: targetFileId, status: 'active' },
        });
        if (!file)
          return res
            .status(404)
            .json({ code: 'FILE_NOT_FOUND', message: 'Pinned file not found.' });
        return res.json({ files: [{ ...file, sizeBytes: file.sizeBytes.toString() }] });
      }

      const files = await prisma.file.findMany({
        where: {
          status: 'active',
          ...(targetFolderId ? { folderId: targetFolderId } : {}),
        },
        orderBy: { createdAt: 'desc' },
      });
      return res.json({
        files: files.map((file) => ({ ...file, sizeBytes: file.sizeBytes.toString() })),
      });
    } catch (error) {
      return next(error);
    }
  },
);

publicApiRouter.get(
  '/v1/files/:id/download',
  requireApiKey('files:read'),
  async (req: ApiKeyRequest, res, next) => {
    try {
      const fileId = String(req.params.id);
      const { targetFileId, targetFolderId } = req.apiKey!;

      const file = await prisma.file.findFirst({
        where: { id: fileId },
        include: { connectedAccount: true },
      });
      if (!file)
        return res.status(404).json({ code: 'FILE_NOT_FOUND', message: 'File not found.' });

      const unrestricted = !targetFileId && !targetFolderId;
      const allowed =
        unrestricted ||
        file.id === targetFileId ||
        (targetFolderId !== null && file.folderId === targetFolderId && file.status === 'active');
      if (!allowed)
        return res
          .status(403)
          .json({ code: 'API_KEY_FORBIDDEN', message: 'API key is not scoped to this file.' });

      return streamProviderFile(file, req.headers.range, res, { disposition: 'attachment' });
    } catch (error) {
      return next(error);
    }
  },
);
