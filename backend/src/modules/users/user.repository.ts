import { prisma } from '../../config/prisma.js';

export function findAllUsers() {
  return prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
}

export function findUserByIdOrThrow(id: string) {
  return prisma.user.findUniqueOrThrow({ where: { id } });
}

export function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export function createUser(data: {
  name: string;
  email: string;
  passwordHash: string;
  role: string;
}) {
  return prisma.user.create({ data });
}

export function updateUser(
  id: string,
  data: { name?: string; email?: string; role?: string; status?: string; passwordHash?: string },
) {
  return prisma.user.update({ where: { id }, data });
}

// Disabling an account is the only access boundary in this shared workspace, so it has to
// tear down the sessions the user already holds — otherwise their access and refresh tokens
// keep working until they expire on their own. API keys are deliberately left alone:
// requireApiKey already rejects keys whose owner is not active, so revoking them adds
// nothing and cannot be undone, which would silently destroy the user's integrations if an
// admin re-enables the account.
export function revokeUserSessions(userId: string) {
  return prisma.userSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
