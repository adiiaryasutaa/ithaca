import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { publicLimiter } from '../../middleware/rate-limit.middleware.js';
import * as publicController from './public.controller.js';

export const publicRouter = Router();

// Only the metadata lookup is limited. The download/preview routes serve ranged media —
// a single video generates hundreds of chunk and seek requests — so limiting them would
// break playback without adding much: a token has to be guessed here first.
publicRouter.get(
  '/files/:token',
  publicLimiter,
  asyncHandler(publicController.getSharedFileMetadata),
);
publicRouter.get('/files/:token/download', asyncHandler(publicController.downloadSharedFile));
publicRouter.get('/files/:token/preview', asyncHandler(publicController.previewSharedFile));
