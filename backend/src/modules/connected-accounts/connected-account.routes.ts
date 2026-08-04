import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth, type AuthRequest } from '../../middleware/auth.middleware.js';
import * as connectedAccountController from './connected-account.controller.js';

export const connectedAccountRouter = Router();

connectedAccountRouter.get('/', requireAuth, asyncHandler<AuthRequest>(connectedAccountController.list));
connectedAccountRouter.post(
  '/s3',
  requireAuth,
  asyncHandler<AuthRequest>(connectedAccountController.connectS3),
);
connectedAccountRouter.get(
  '/google/connect-url',
  requireAuth,
  asyncHandler<AuthRequest>(connectedAccountController.getGoogleConnectUrl),
);
connectedAccountRouter.get(
  '/google/connect',
  requireAuth,
  asyncHandler<AuthRequest>(connectedAccountController.redirectToGoogleConnect),
);
connectedAccountRouter.get(
  '/google/callback',
  asyncHandler(connectedAccountController.googleCallback),
);
connectedAccountRouter.post(
  '/:id/sync-quota',
  requireAuth,
  asyncHandler<AuthRequest>(connectedAccountController.syncQuota),
);
connectedAccountRouter.delete(
  '/:id',
  requireAuth,
  asyncHandler<AuthRequest>(connectedAccountController.disconnect),
);
