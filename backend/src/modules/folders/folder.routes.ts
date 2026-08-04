import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth, type AuthRequest } from '../../middleware/auth.middleware.js';
import * as folderController from './folder.controller.js';

export const folderRouter = Router();
folderRouter.use(requireAuth);

folderRouter.get('/', asyncHandler<AuthRequest>(folderController.list));
folderRouter.get('/recent', asyncHandler<AuthRequest>(folderController.recent));
folderRouter.post('/', asyncHandler<AuthRequest>(folderController.create));
folderRouter.patch('/:id', asyncHandler<AuthRequest>(folderController.update));
folderRouter.delete('/:id', asyncHandler<AuthRequest>(folderController.remove));
