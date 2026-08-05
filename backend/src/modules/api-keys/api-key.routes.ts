import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth, type AuthRequest } from '../../middleware/auth.middleware.js';
import * as apiKeyController from './api-key.controller.js';

export const apiKeyRouter = Router();
apiKeyRouter.use(requireAuth);

apiKeyRouter.get('/', asyncHandler<AuthRequest>(apiKeyController.list));
apiKeyRouter.post('/', asyncHandler<AuthRequest>(apiKeyController.create));
apiKeyRouter.delete('/:id', asyncHandler<AuthRequest>(apiKeyController.revoke));
