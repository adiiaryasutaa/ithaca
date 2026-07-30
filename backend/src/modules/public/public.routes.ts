import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { hashToken } from '../../utils/crypto.js';
import { publicLimiter } from '../../middleware/rate-limit.middleware.js';
import { streamProviderFile } from '../files/stream-file.js';

export const publicRouter = Router();

async function findSharedFile(token: string) {
  const share = await prisma.fileShare.findFirst({
    where: {
      enabled: true,
      AND: [
        { OR: [{ token }, { tokenHash: hashToken(token) }] },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      ],
    },
    include: { file: { include: { connectedAccount: true } } },
  });
  if (!share || share.file.status !== 'active') throw new Error('Shared file not found');
  return share.file;
}

// Only the metadata lookup is limited. The download/preview routes serve ranged media —
// a single video generates hundreds of chunk and seek requests — so limiting them would
// break playback without adding much: a token has to be guessed here first.
publicRouter.get('/files/:token', publicLimiter, async (req, res, next) => {
  try {
    const file = await findSharedFile(String(req.params.token));
    return res.json({
      file: {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes.toString(),
        createdAt: file.createdAt,
      },
    });
  } catch (error) {
    return next(error);
  }
});

publicRouter.get('/files/:token/download', async (req, res, next) => {
  try {
    const file = await findSharedFile(String(req.params.token));
    return streamProviderFile(file, req.headers.range, res, { disposition: 'attachment' });
  } catch (error) {
    return next(error);
  }
});

publicRouter.get('/files/:token/preview', async (req, res, next) => {
  try {
    const file = await findSharedFile(String(req.params.token));
    return streamProviderFile(file, req.headers.range, res, { disposition: 'inline' });
  } catch (error) {
    return next(error);
  }
});
