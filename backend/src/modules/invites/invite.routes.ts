import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth, type AuthRequest } from '../../middleware/auth.middleware.js';
import * as inviteController from './invite.controller.js';

export const inviteRouter = Router();
inviteRouter.use(requireAuth);

inviteRouter.get('/', asyncHandler<AuthRequest>(inviteController.list));
inviteRouter.post('/', asyncHandler<AuthRequest>(inviteController.create));
inviteRouter.delete('/:id', asyncHandler<AuthRequest>(inviteController.revoke));
