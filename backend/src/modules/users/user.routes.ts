import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth, requireAdmin, type AuthRequest } from '../../middleware/auth.middleware.js';
import * as userController from './user.controller.js';

export const userRouter = Router();
userRouter.use(requireAuth, requireAdmin);

userRouter.get('/', asyncHandler<AuthRequest>(userController.list));
userRouter.get('/:id', asyncHandler<AuthRequest>(userController.getById));
userRouter.post('/', asyncHandler<AuthRequest>(userController.create));
userRouter.patch('/:id', asyncHandler<AuthRequest>(userController.update));
userRouter.delete('/:id', asyncHandler<AuthRequest>(userController.remove));
