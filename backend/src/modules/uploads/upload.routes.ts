import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth, type AuthRequest } from '../../middleware/auth.middleware.js';
import * as uploadController from './upload.controller.js';
import type { UploadRequest } from './upload.controller.js';

export const uploadRouter = Router();

uploadRouter.post('/', requireAuth, asyncHandler<UploadRequest>(uploadController.handleUpload));

uploadRouter.post(
  '/resumable/init',
  requireAuth,
  asyncHandler<AuthRequest>(uploadController.initResumable),
);
uploadRouter.get(
  '/resumable/status/:id',
  requireAuth,
  asyncHandler<AuthRequest>(uploadController.getResumableStatus),
);
uploadRouter.put(
  '/resumable/chunk/:id',
  requireAuth,
  asyncHandler<AuthRequest>(uploadController.putResumableChunk),
);
