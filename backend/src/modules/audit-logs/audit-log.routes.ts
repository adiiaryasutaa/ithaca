import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth, type AuthRequest } from '../../middleware/auth.middleware.js';
import * as auditLogController from './audit-log.controller.js';

export const auditLogRouter = Router();

auditLogRouter.get('/', requireAuth, asyncHandler<AuthRequest>(auditLogController.list));
