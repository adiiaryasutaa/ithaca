import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.middleware.js';
import * as systemController from './system.controller.js';

export const systemRouter = Router();

// Every route here is a privileged ops lever — triggering a code pull + process restart,
// or rewriting the global Google OAuth credentials. Admin-only, not merely authenticated.
systemRouter.use(requireAuth, requireAdmin);

systemRouter.post('/update', systemController.triggerUpdate);
systemRouter.get('/update-log', systemController.getUpdateLog);
systemRouter.get('/google-config', asyncHandler(systemController.getGoogleConfig));
systemRouter.post('/google-config', asyncHandler(systemController.setGoogleConfig));
systemRouter.get('/backup', systemController.getBackup);
systemRouter.post('/restore', systemController.restoreBackup);
