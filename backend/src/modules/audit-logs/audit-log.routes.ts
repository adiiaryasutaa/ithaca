import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { requireAuth, type AuthRequest } from '../../middleware/auth.middleware.js';

export const auditLogRouter = Router();

auditLogRouter.get('/', requireAuth, async (_req: AuthRequest, res, next) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { email: true } } },
    });
    return res.json({
      logs: logs.map(({ user, ...log }) => ({ ...log, actorEmail: user?.email ?? null })),
    });
  } catch (error) {
    return next(error);
  }
});
