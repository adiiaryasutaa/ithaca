import { prisma } from '../../config/prisma.js';

export function findActiveFileById(id: string) {
  return prisma.file.findFirst({ where: { id, status: 'active' } });
}

export function findActiveFiles(folderId: string | null) {
  return prisma.file.findMany({
    where: { status: 'active', ...(folderId ? { folderId } : {}) },
    orderBy: { createdAt: 'desc' },
  });
}

export function findFileByIdWithAccount(id: string) {
  return prisma.file.findFirst({ where: { id }, include: { connectedAccount: true } });
}
