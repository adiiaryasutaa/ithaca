import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth, type AuthRequest } from '../../middleware/auth.middleware.js';
import * as providerConfigController from './provider-config.controller.js';

export const providerConfigRouter = Router();
providerConfigRouter.use(requireAuth);

providerConfigRouter.post(
  '/google',
  asyncHandler<AuthRequest>(providerConfigController.createGoogle),
);
providerConfigRouter.get('/', asyncHandler<AuthRequest>(providerConfigController.list));
providerConfigRouter.delete('/:id', asyncHandler<AuthRequest>(providerConfigController.remove));
