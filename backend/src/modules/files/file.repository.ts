import { prisma } from '../../config/prisma.js';

export const fileWithRelationsSelect = {
  connectedAccount: { select: { id: true, email: true, provider: true } },
  folder: { select: { id: true, name: true } },
} as const;

export function findFilesForListing(where: any) {
  return prisma.file.findMany({
    where,
    include: fileWithRelationsSelect,
    orderBy: { createdAt: 'desc' },
  });
}

export function findTrashedFiles(where: any) {
  return prisma.file.findMany({
    where,
    include: fileWithRelationsSelect,
    orderBy: { deletedAt: 'desc' },
  });
}

export function findFileByIdWithRelations(id: string) {
  return prisma.file.findFirstOrThrow({ where: { id }, include: fileWithRelationsSelect });
}

export function findFileWithAccount(id: string) {
  return prisma.file.findFirstOrThrow({ where: { id }, include: { connectedAccount: true } });
}

export function findActiveFileById(id: string) {
  return prisma.file.findFirstOrThrow({ where: { id, status: 'active' } });
}

export function updateFileFields(id: string, data: { name?: string; folderId?: string | null }) {
  return prisma.file.update({ where: { id }, data, include: fileWithRelationsSelect });
}

export function markFileDeleted(id: string) {
  return prisma.file.update({ where: { id }, data: { status: 'deleted', deletedAt: new Date() } });
}

export function assertFolderExists(folderId: string) {
  return prisma.folder.findFirstOrThrow({ where: { id: folderId, deletedAt: null } });
}

export function findActiveFilesByIds(ids: string[]) {
  return prisma.file.findMany({ where: { id: { in: ids }, status: 'active' } });
}

export function updateManyFolderId(ids: string[], folderId: string | null) {
  return prisma.file.updateMany({
    where: { id: { in: ids }, status: 'active' },
    data: { folderId },
  });
}

export function updateManyStatusDeleted(ids: string[]) {
  return prisma.file.updateMany({
    where: { id: { in: ids }, status: 'active' },
    data: { status: 'deleted', deletedAt: new Date() },
  });
}

export function findDeletedFilesByIds(ids: string[]) {
  return prisma.file.findMany({ where: { id: { in: ids }, status: 'deleted' } });
}

export function updateManyStatusActive(ids: string[]) {
  return prisma.file.updateMany({
    where: { id: { in: ids }, status: 'deleted' },
    data: { status: 'active', deletedAt: null },
  });
}

export function findDeletedFilesByIdsWithAccount(ids: string[]) {
  return prisma.file.findMany({
    where: { id: { in: ids }, status: 'deleted' },
    include: { connectedAccount: true },
  });
}

export function deleteManyByIds(ids: string[]) {
  return prisma.file.deleteMany({ where: { id: { in: ids } } });
}

export function findActiveFilesByIdsWithAccount(ids: string[]) {
  return prisma.file.findMany({
    where: { id: { in: ids }, status: 'active' },
    include: { connectedAccount: true },
  });
}

export function findActiveSharedLinks() {
  return prisma.fileShare.findMany({
    where: { enabled: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    include: {
      file: {
        include: {
          connectedAccount: { select: { email: true, provider: true } },
          folder: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export function findExistingShare(fileId: string) {
  return prisma.fileShare.findFirst({
    where: { fileId, enabled: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    orderBy: { createdAt: 'desc' },
  });
}

export function createShare(fileId: string, userId: string, token: string, tokenHash: string) {
  return prisma.fileShare.create({ data: { fileId, userId, token, tokenHash } });
}

export function revokeSharesForFile(fileId: string) {
  return prisma.fileShare.updateMany({
    where: { fileId, enabled: true },
    data: { enabled: false },
  });
}

export function createPreviewTokenRow(
  fileId: string,
  userId: string,
  tokenHash: string,
  expiresAt: Date,
) {
  return prisma.filePreviewToken.create({ data: { fileId, userId, tokenHash, expiresAt } });
}

export function findValidPreviewToken(tokenHash: string) {
  return prisma.filePreviewToken.findFirst({
    where: { tokenHash, expiresAt: { gt: new Date() } },
    include: { file: { include: { connectedAccount: true } } },
  });
}

export function findGoogleConnectedAccountIds(connectedAccountId?: string) {
  return prisma.connectedAccount.findMany({
    where: {
      provider: 'google_drive',
      status: 'connected',
      ...(connectedAccountId ? { id: connectedAccountId } : {}),
    },
    select: { id: true },
  });
}
