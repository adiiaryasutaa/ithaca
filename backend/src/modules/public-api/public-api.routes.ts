import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireApiKey, type ApiKeyRequest } from '../../middleware/api-key.middleware.js';
import { handleUpload } from '../uploads/upload.controller.js';
import * as publicApiController from './public-api.controller.js';

export const publicApiRouter = Router();

publicApiRouter.post('/v1/uploads', requireApiKey('files:upload'), handleUpload);

publicApiRouter.get(
  '/v1/files',
  requireApiKey('files:read'),
  asyncHandler<ApiKeyRequest>(publicApiController.listFiles),
);

publicApiRouter.get(
  '/v1/files/:id/download',
  requireApiKey('files:read'),
  asyncHandler<ApiKeyRequest>(publicApiController.downloadFile),
);
