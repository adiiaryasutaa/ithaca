import { google } from 'googleapis';
import type { ConnectedAccount, File } from '@prisma/client';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { createAuditLog } from '../../utils/audit.js';
import { hashToken, randomToken } from '../../utils/crypto.js';
import { HttpError } from '../../utils/http-error.js';
import { bigintToString } from '../../utils/serialize.js';
import {
  deleteGoogleDriveItem,
  getAuthedGoogleClient,
  makeGoogleFilePublic,
  syncGoogleAppFolderFiles,
} from '../google/google.service.js';
import { deleteS3Object } from '../s3/s3.service.js';
import { syncQuotaForAccount } from '../storage/quota-sync.service.js';
import * as fileRepository from './file.repository.js';

type FileWithAccount = File & { connectedAccount: ConnectedAccount };

export function toFileResponse(file: { sizeBytes: bigint } & Record<string, unknown>) {
  return { ...file, sizeBytes: bigintToString(file.sizeBytes) };
}

const typeFilters: Record<string, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  video: ['video/mp4', 'video/mpeg', 'video/ogg', 'video/quicktime', 'video/webm'],
  pdf: ['application/pdf'],
  doc: [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ],
  archive: [
    'application/zip',
    'application/x-rar-compressed',
    'application/x-tar',
    'application/x-7z-compressed',
  ],
};

export type FileListQuery = {
  folderId?: string;
  unfiled?: '1';
  q?: string;
  kind?: 'image' | 'video' | 'pdf' | 'doc' | 'archive';
  accountId?: string;
  minSize?: number;
  maxSize?: number;
  startDate?: string;
  endDate?: string;
};

export async function listFiles(query: FileListQuery) {
  const where: any = {
    status: 'active',
    ...(query.folderId ? { folderId: query.folderId } : query.unfiled ? { folderId: null } : {}),
    ...(query.q ? { name: { contains: query.q, mode: 'insensitive' } } : {}),
    ...(query.accountId ? { connectedAccountId: query.accountId } : {}),
    ...(query.kind ? { mimeType: { in: typeFilters[query.kind] || [] } } : {}),
    ...(query.minSize !== undefined || query.maxSize !== undefined
      ? {
          sizeBytes: {
            ...(query.minSize !== undefined ? { gte: BigInt(query.minSize) } : {}),
            ...(query.maxSize !== undefined ? { lte: BigInt(query.maxSize) } : {}),
          },
        }
      : {}),
    ...(query.startDate || query.endDate
      ? {
          createdAt: {
            ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
            ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
          },
        }
      : {}),
  };
  const files = await fileRepository.findFilesForListing(where);
  return files.map(toFileResponse);
}

export async function listTrashedFiles(query: { q?: string }) {
  const where: any = {
    status: 'deleted',
    ...(query.q ? { name: { contains: query.q, mode: 'insensitive' } } : {}),
  };
  const files = await fileRepository.findTrashedFiles(where);
  return files.map(toFileResponse);
}

export async function getFileById(id: string) {
  return fileRepository.findFileByIdWithRelations(id);
}

export function getFileWithAccount(id: string) {
  return fileRepository.findFileWithAccount(id);
}

export async function moveFilesBatch(
  userId: string,
  fileIds: string[],
  folderId: string | null | undefined,
) {
  if (folderId) await fileRepository.assertFolderExists(folderId);
  const result = await fileRepository.updateManyFolderId(fileIds, folderId ?? null);
  await createAuditLog(userId, 'MOVE_FILES', 'file', undefined, {
    count: result.count,
    folderId,
  });
  return result.count;
}

export async function trashFilesBatch(userId: string, fileIds: string[]) {
  const files = await fileRepository.findActiveFilesByIds(fileIds);
  const result = await fileRepository.updateManyStatusDeleted(fileIds);
  for (const f of files) await createAuditLog(userId, 'TRASH_FILE', 'file', f.id, { name: f.name });
  return result.count;
}

export async function restoreFilesBatch(userId: string, fileIds: string[]) {
  const files = await fileRepository.findDeletedFilesByIds(fileIds);
  const result = await fileRepository.updateManyStatusActive(fileIds);
  for (const f of files)
    await createAuditLog(userId, 'RESTORE_FILE', 'file', f.id, { name: f.name });
  return result.count;
}

export async function permanentlyDeleteFilesBatch(userId: string, fileIds: string[]) {
  const files = await fileRepository.findDeletedFilesByIdsWithAccount(fileIds);
  const deletedIds: string[] = [];
  const syncedAccounts = new Map<string, ConnectedAccount>();
  const failed: Array<{ fileId: string; message: string }> = [];

  for (const file of files) {
    try {
      if (file.provider === 's3') {
        await deleteS3Object(file);
      } else {
        await deleteGoogleDriveItem(file.connectedAccount, file.providerFileId);
      }
      deletedIds.push(file.id);
      syncedAccounts.set(file.connectedAccountId, file.connectedAccount);
      await createAuditLog(userId, 'PERMANENT_DELETE_FILE', 'file', file.id, {
        name: file.name,
      });
    } catch (error) {
      failed.push({
        fileId: file.id,
        message: error instanceof Error ? error.message : 'Delete failed',
      });
    }
  }

  if (deletedIds.length > 0) await fileRepository.deleteManyByIds(deletedIds);

  for (const account of syncedAccounts.values()) {
    await syncQuotaForAccount(account).catch(() => undefined);
  }

  return { deleted: deletedIds.length, failed };
}

export async function listSharedLinks() {
  const shares = await fileRepository.findActiveSharedLinks();
  return shares
    .filter((share) => share.file.status === 'active')
    .map((share) => ({
      id: share.id,
      url: share.token ? `${env.FRONTEND_URL}/public/files/${share.token}` : null,
      createdAt: share.createdAt.toISOString(),
      expiresAt: share.expiresAt?.toISOString() ?? null,
      file: toFileResponse(share.file),
    }));
}

export async function syncGoogleAccounts(userId: string, connectedAccountId?: string) {
  const accounts = await fileRepository.findGoogleConnectedAccountIds(connectedAccountId);
  const results = [];
  for (const account of accounts) results.push(await syncGoogleAppFolderFiles(account.id, userId));
  return results;
}

export async function updateFile(
  userId: string,
  id: string,
  body: { name?: string; folderId?: string | null },
) {
  const file = await fileRepository.findFileWithAccount(id);
  const drive =
    file.provider === 's3'
      ? null
      : google.drive({ version: 'v3', auth: await getAuthedGoogleClient(file.connectedAccount) });
  if (body.folderId) await fileRepository.assertFolderExists(body.folderId);
  if (body.name && drive)
    await drive.files.update({ fileId: file.providerFileId, requestBody: { name: body.name } });
  const data = {
    ...(body.name ? { name: body.name } : {}),
    ...(body.folderId !== undefined ? { folderId: body.folderId } : {}),
  };
  const updated = await fileRepository.updateFileFields(file.id, data);
  await createAuditLog(userId, 'UPDATE_FILE', 'file', updated.id, {
    name: updated.name,
    updates: body,
  });
  return updated;
}

export async function createOrGetShare(userId: string, id: string) {
  const file = await fileRepository.findActiveFileById(id);
  const existingShare = await fileRepository.findExistingShare(file.id);
  if (existingShare)
    return {
      url: `${env.FRONTEND_URL}/public/files/${existingShare.token}`,
      shareId: existingShare.id,
      created: false,
    };
  const token = randomToken(32);
  const share = await fileRepository.createShare(file.id, userId, token, hashToken(token));
  return { url: `${env.FRONTEND_URL}/public/files/${token}`, shareId: share.id, created: true };
}

export function revokeShare(id: string) {
  return fileRepository.revokeSharesForFile(id);
}

export async function createPreviewToken(userId: string, fileId: string) {
  const file = await fileRepository.findActiveFileById(fileId);
  const token = randomToken(32);
  await fileRepository.createPreviewTokenRow(
    file.id,
    userId,
    hashToken(token),
    new Date(Date.now() + 10 * 60_000),
  );
  return { path: `/files/preview/${token}` };
}

export async function getFileByPreviewToken(token: string) {
  const preview = await fileRepository.findValidPreviewToken(hashToken(token));
  if (!preview || preview.file.status !== 'active')
    throw new HttpError(404, 'PREVIEW_NOT_FOUND', 'Preview token not found.');
  return preview.file;
}

export async function getViewUrl(fileId: string) {
  const file = await fileRepository.findFileWithAccount(fileId);
  if (file.provider === 's3') return null;
  const auth = await getAuthedGoogleClient(file.connectedAccount);
  const drive = google.drive({ version: 'v3', auth });
  try {
    await makeGoogleFilePublic(drive, file.providerFileId);
  } catch (err) {
    logger.error({ err }, 'Failed to make Google Drive file public during view-url retrieval');
  }
  const metadata = await drive.files.get({
    fileId: file.providerFileId,
    fields: 'webViewLink,webContentLink',
  });
  return metadata.data.webViewLink ?? metadata.data.webContentLink;
}

export async function makeGoogleFileWebPublic(file: FileWithAccount) {
  const auth = await getAuthedGoogleClient(file.connectedAccount);
  const drive = google.drive({ version: 'v3', auth });
  await makeGoogleFilePublic(drive, file.providerFileId);
  const metadata = await drive.files.get({
    fileId: file.providerFileId,
    fields: 'webViewLink,webContentLink',
  });
  return metadata.data.webViewLink ?? metadata.data.webContentLink;
}

export async function trashFile(userId: string, fileId: string) {
  const file = await fileRepository.findActiveFileById(fileId);
  await fileRepository.markFileDeleted(file.id);
  await createAuditLog(userId, 'TRASH_FILE', 'file', file.id, { name: file.name });
}

export async function getFilesForBatchDownload(fileIds: string[]) {
  const files = await fileRepository.findActiveFilesByIdsWithAccount(fileIds);
  if (files.length === 0) throw new HttpError(404, 'FILES_NOT_FOUND', 'No files found.');
  return files;
}
