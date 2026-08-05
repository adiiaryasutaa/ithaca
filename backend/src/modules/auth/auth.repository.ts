import { prisma } from '../../config/prisma.js';
import type { AuthRequest } from '../../middleware/auth.middleware.js';

export function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export function findActiveGlobalGoogleProviderConfig() {
  return prisma.providerConfig.findFirstOrThrow({
    where: { userId: null, provider: 'google_drive', status: 'active' },
    orderBy: { createdAt: 'desc' },
  });
}

export function createUserSession(
  userId: string,
  refreshTokenHash: string,
  expiresAt: Date,
  req: AuthRequest,
) {
  return prisma.userSession.create({
    data: {
      userId,
      refreshTokenHash,
      userAgent: req.header('User-Agent'),
      ipAddress: req.ip,
      expiresAt,
    },
  });
}

export function findValidAuthHandoff(tokenHash: string) {
  return prisma.authHandoff.findFirst({
    where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    include: { user: true },
  });
}

export function markAuthHandoffUsed(id: string) {
  return prisma.authHandoff.update({ where: { id }, data: { usedAt: new Date() } });
}

export function findActiveSessionByRefreshHash(refreshTokenHash: string) {
  return prisma.userSession.findFirst({
    where: { refreshTokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    include: { user: { select: { status: true } } },
  });
}

export function rotateSessionRefreshToken(
  sessionId: string,
  presentedHash: string,
  newHash: string,
) {
  return prisma.userSession.updateMany({
    where: { id: sessionId, refreshTokenHash: presentedHash },
    data: { refreshTokenHash: newHash },
  });
}

export function revokeSession(sessionId: string) {
  return prisma.userSession.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
}

export function findUserProfileById(id: string) {
  return prisma.user.findUniqueOrThrow({
    where: { id },
    select: { id: true, name: true, email: true, status: true, role: true },
  });
}
