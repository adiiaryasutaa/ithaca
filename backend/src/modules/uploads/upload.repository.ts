import { prisma } from '../../config/prisma.js';

export function findConnectedAccountsForRouting(targetAccountId?: string | null) {
  return prisma.connectedAccount.findMany({
    where: {
      provider: { in: ['google_drive', 's3'] },
      status: 'connected',
      ...(targetAccountId ? { id: targetAccountId } : {}),
    },
    include: { storageAccount: true },
  });
}

export function setConnectedAccountLastError(accountId: string, message: string) {
  return prisma.connectedAccount
    .update({ where: { id: accountId }, data: { lastError: message } })
    .catch(() => undefined);
}

export function incrementRoutingPolicyCursor(policyId: string, nextCursor: number) {
  return prisma.uploadRoutingPolicy.update({
    where: { id: policyId },
    data: { roundRobinCursor: nextCursor },
  });
}

export function findActiveFolderById(folderId: string) {
  return prisma.folder.findFirstOrThrow({ where: { id: folderId, deletedAt: null } });
}

export function findFolderById(folderId: string) {
  return prisma.folder.findFirst({ where: { id: folderId } });
}

export function createUploadSession(data: {
  userId: string;
  targetConnectedAccountId: string;
  folderId: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: bigint;
  status: string;
  googleSessionUri?: string;
}) {
  return prisma.uploadSession.create({ data });
}

export function findUploadSessionById(id: string) {
  return prisma.uploadSession.findFirstOrThrow({ where: { id } });
}

export function updateUploadSession(
  id: string,
  data: { status: string; completedAt?: Date; errorMessage?: string },
) {
  return prisma.uploadSession.update({ where: { id }, data });
}

export function findConnectedAccountById(id: string) {
  return prisma.connectedAccount.findFirstOrThrow({ where: { id } });
}

export function createProvisionalS3File(data: {
  userId: string;
  connectedAccountId: string;
  folderId: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: bigint;
}) {
  return prisma.file.create({
    data: {
      userId: data.userId,
      connectedAccountId: data.connectedAccountId,
      folderId: data.folderId,
      provider: 's3',
      providerFileId: 'pending',
      name: data.fileName,
      mimeType: data.mimeType,
      sizeBytes: data.sizeBytes,
      status: 'uploading',
    },
  });
}

export function finalizeS3File(id: string, providerFileId: string) {
  return prisma.file.update({ where: { id }, data: { providerFileId, status: 'active' } });
}

export function softDeleteFile(id: string) {
  return prisma.file
    .update({ where: { id }, data: { status: 'deleted', deletedAt: new Date() } })
    .catch(() => undefined);
}

export function createGoogleFile(data: {
  userId: string;
  connectedAccountId: string;
  folderId: string | null;
  providerFileId: string;
  name: string;
  mimeType: string;
  sizeBytes: bigint;
}) {
  return prisma.file.create({
    data: {
      userId: data.userId,
      connectedAccountId: data.connectedAccountId,
      folderId: data.folderId,
      provider: 'google_drive',
      providerFileId: data.providerFileId,
      name: data.name,
      mimeType: data.mimeType,
      sizeBytes: data.sizeBytes,
    },
  });
}

export function findFileByProviderFileId(providerFileId: string) {
  return prisma.file.findFirst({ where: { providerFileId } });
}
