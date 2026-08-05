import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth, type AuthRequest } from '../../middleware/auth.middleware.js';
import * as storageController from './storage.controller.js';

export const storageRouter = Router();
storageRouter.use(requireAuth);

storageRouter.get('/summary', asyncHandler<AuthRequest>(storageController.getSummary));
storageRouter.get(
  '/routing-policy',
  asyncHandler<AuthRequest>(storageController.getRoutingPolicy),
);
storageRouter.patch(
  '/routing-policy',
  asyncHandler<AuthRequest>(storageController.updateRoutingPolicy),
);
storageRouter.get('/breakdown', asyncHandler<AuthRequest>(storageController.getBreakdown));
