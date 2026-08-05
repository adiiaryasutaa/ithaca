import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth, type AuthRequest } from '../../middleware/auth.middleware.js';
import * as fileController from './file.controller.js';

export const fileRouter = Router();

fileRouter.get('/preview/:token', asyncHandler(fileController.previewByToken));

fileRouter.use(requireAuth);

fileRouter.get('/', asyncHandler<AuthRequest>(fileController.list));
fileRouter.patch('/batch', asyncHandler<AuthRequest>(fileController.moveBatch));
fileRouter.delete('/batch', asyncHandler<AuthRequest>(fileController.trashBatch));
fileRouter.get('/trash', asyncHandler<AuthRequest>(fileController.listTrash));
fileRouter.post('/batch/restore', asyncHandler<AuthRequest>(fileController.restoreBatch));
fileRouter.delete(
  '/batch/permanent',
  asyncHandler<AuthRequest>(fileController.permanentDeleteBatch),
);
fileRouter.get('/shared-links', asyncHandler<AuthRequest>(fileController.sharedLinks));
fileRouter.post('/sync-google', asyncHandler<AuthRequest>(fileController.syncGoogle));
fileRouter.get('/:id', asyncHandler<AuthRequest>(fileController.getById));
fileRouter.patch('/:id', asyncHandler<AuthRequest>(fileController.update));
fileRouter.post('/:id/share', asyncHandler<AuthRequest>(fileController.createShare));
fileRouter.post(
  '/:id/public-permission',
  requireAuth,
  asyncHandler<AuthRequest>(fileController.makePublic),
);
fileRouter.delete('/:id/share', asyncHandler<AuthRequest>(fileController.deleteShare));
fileRouter.post(
  '/:id/preview-token',
  asyncHandler<AuthRequest>(fileController.createPreviewToken),
);
fileRouter.get('/:id/view-url', asyncHandler<AuthRequest>(fileController.getViewUrl));
fileRouter.get('/:id/download', asyncHandler<AuthRequest>(fileController.download));
fileRouter.delete('/:id', asyncHandler<AuthRequest>(fileController.remove));
fileRouter.post('/batch-download', asyncHandler<AuthRequest>(fileController.batchDownload));
