import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';

export const folderSelect = {
  id: true,
  name: true,
  color: true,
  iconUrl: true,
  parentId: true,
  providerFolderId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function findActiveFolders(where: Prisma.FolderWhereInput) {
  return prisma.folder.findMany({
    where: { deletedAt: null, ...where },
    select: folderSelect,
    orderBy: { updatedAt: 'desc' },
  });
}

export function findRecentFolders(limit: number) {
  return prisma.folder.findMany({
    where: { deletedAt: null },
    select: folderSelect,
    orderBy: { updatedAt: 'desc' },
    take: limit,
  });
}

export function findConnectedGoogleDriveAccount() {
  return prisma.connectedAccount.findFirst({
    where: { provider: 'google_drive', status: 'connected' },
  });
}

export function findFolderById(id: string) {
  return prisma.folder.findFirst({ where: { id } });
}

export function updateFolderProviderId(
  id: string,
  data: { providerFolderId: string; connectedAccountId: string },
) {
  return prisma.folder.update({ where: { id }, data });
}

export function findActiveFolderByIdOrThrow(id: string) {
  return prisma.folder.findFirstOrThrow({ where: { id, deletedAt: null } });
}

export function findActiveFolderWithAccountOrThrow(id: string) {
  return prisma.folder.findFirstOrThrow({
    where: { id, deletedAt: null },
    include: { connectedAccount: true },
  });
}

export function findAllActiveFolderParentLinks() {
  return prisma.folder.findMany({
    where: { deletedAt: null },
    select: { id: true, parentId: true },
  });
}

export function updateFolderFields(id: string, data: Prisma.FolderUpdateManyMutationInput) {
  return prisma.folder.updateMany({ where: { id, deletedAt: null }, data });
}

export function findFolderByIdSelect(id: string) {
  return prisma.folder.findFirstOrThrow({ where: { id }, select: folderSelect });
}

export function createFolder(data: Prisma.FolderUncheckedCreateInput) {
  return prisma.folder.create({ data, select: folderSelect });
}

export function findActiveFilesInFolders(folderIds: string[]) {
  return prisma.file.findMany({
    where: { status: 'active', folderId: { in: folderIds } },
    include: { connectedAccount: true },
  });
}

export function findFoldersByIdsWithAccount(folderIds: string[]) {
  return prisma.folder.findMany({
    where: { id: { in: folderIds } },
    include: { connectedAccount: true },
  });
}

export function markFilesDeletedByIds(fileIds: string[]) {
  return prisma.file.updateMany({
    where: { id: { in: fileIds } },
    data: { status: 'deleted', deletedAt: new Date() },
  });
}

export function markFoldersDeletedByIds(folderIds: string[]) {
  return prisma.folder.updateMany({
    where: { id: { in: folderIds } },
    data: { deletedAt: new Date() },
  });
}
