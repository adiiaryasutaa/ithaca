import { prisma } from '../../config/prisma.js';

export const targetSelect = { select: { id: true, name: true } };

export function findAllApiKeys() {
  return prisma.apiKey.findMany({
    orderBy: { createdAt: 'desc' },
    include: { targetFolder: targetSelect, targetFile: targetSelect },
  });
}

export function findActiveFolderByIdOrThrow(id: string) {
  return prisma.folder.findFirstOrThrow({ where: { id, deletedAt: null } });
}

export function findActiveFileByIdOrThrow(id: string) {
  return prisma.file.findFirstOrThrow({ where: { id, status: 'active' } });
}

export function createApiKey(data: {
  userId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  scopes: string[];
  expiresAt: Date | null;
  targetFolderId: string | null;
  targetFileId: string | null;
}) {
  return prisma.apiKey.create({
    data,
    include: { targetFolder: targetSelect, targetFile: targetSelect },
  });
}

export function revokeApiKeyById(id: string) {
  return prisma.apiKey.updateMany({
    where: { id, revokedAt: null },
    data: { status: 'revoked', revokedAt: new Date() },
  });
}
