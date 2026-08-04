import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth, type AuthRequest } from '../../middleware/auth.middleware.js';
import { credentialsLimiter, refreshLimiter } from '../../middleware/rate-limit.middleware.js';
import * as authController from './auth.controller.js';

export const authRouter = Router();

authRouter.post('/login', credentialsLimiter, asyncHandler(authController.login));
authRouter.get('/google/url', credentialsLimiter, asyncHandler(authController.getGoogleUrl));
authRouter.get('/google/callback', asyncHandler(authController.googleCallback));
authRouter.post(
  '/google/exchange',
  credentialsLimiter,
  asyncHandler<AuthRequest>(authController.exchangeGoogleHandoff),
);
authRouter.post('/refresh', refreshLimiter, asyncHandler(authController.refresh));
authRouter.post('/logout', requireAuth, asyncHandler<AuthRequest>(authController.logout));
authRouter.get('/me', requireAuth, asyncHandler<AuthRequest>(authController.me));
