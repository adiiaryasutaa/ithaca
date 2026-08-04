import { prisma } from '../../config/prisma.js';
import { encryptText } from '../../utils/crypto.js';

export async function findProviderConfigById(id: string) {
  return prisma.providerConfig.findUniqueOrThrow({ where: { id } });
}

export async function updateConnectedAccountTokens(
  accountId: string,
  data: { accessTokenEncrypted: string; tokenExpiresAt: Date },
) {
  return prisma.connectedAccount.update({ where: { id: accountId }, data });
}

export async function findConnectedAccountById(id: string) {
  return prisma.connectedAccount.findUniqueOrThrow({ where: { id } });
}

export async function findConnectedGoogleAccountById(id: string) {
  return prisma.connectedAccount.findFirstOrThrow({
    where: { id, provider: 'google_drive', status: 'connected' },
  });
}

export async function upsertStorageAccountQuota(
  connectedAccountId: string,
  data: {
    totalBytes: bigint | null;
    usedBytes: bigint;
    availableBytes: bigint | null;
    trashBytes: bigint | null;
  },
) {
  return prisma.storageAccount.upsert({
    where: { connectedAccountId },
    create: { connectedAccountId, ...data, lastSyncedAt: new Date() },
    update: { ...data, lastSyncedAt: new Date() },
  });
}

export async function findWorkspaceFoldersForAccount(connectedAccountId: string) {
  return prisma.folder.findMany({
    where: { connectedAccountId, deletedAt: null },
    select: { id: true, providerFolderId: true },
  });
}

export async function findGoogleFilesForAccount(connectedAccountId: string) {
  return prisma.file.findMany({
    where: { connectedAccountId, provider: 'google_drive' },
  });
}

export async function createSyncedGoogleFile(data: {
  userId: string;
  connectedAccountId: string;
  providerFileId: string;
  name: string;
  mimeType: string;
  sizeBytes: bigint;
  folderId: string | null;
}) {
  return prisma.file.create({
    data: { ...data, provider: 'google_drive', status: 'active' },
  });
}

export async function updateSyncedGoogleFile(
  fileId: string,
  data: { name: string; mimeType: string; sizeBytes: bigint; folderId: string | null },
) {
  return prisma.file.update({
    where: { id: fileId },
    data: { ...data, status: 'active', deletedAt: null },
  });
}

export async function markFilesDeleted(fileIds: string[]) {
  return prisma.file.updateMany({
    where: { id: { in: fileIds } },
    data: { status: 'deleted', deletedAt: new Date() },
  });
}

export async function createOAuthState(data: {
  providerConfigId: string;
  flow: string;
  stateHash: string;
  expiresAt: Date;
  userId?: string;
}) {
  return prisma.oauthState.create({ data });
}

export async function findGoogleConnectedAccountByProviderAccountId(providerAccountId: string) {
  return prisma.connectedAccount.findUnique({
    where: { provider_providerAccountId: { provider: 'google_drive', providerAccountId } },
  });
}

export async function findOAuthStateByHash(stateHash: string) {
  return prisma.oauthState.findUniqueOrThrow({
    where: { stateHash },
    include: { providerConfig: true },
  });
}

export async function markOAuthStateUsed(id: string, userId?: string) {
  return prisma.oauthState.update({
    where: { id },
    data: { usedAt: new Date(), userId },
  });
}

export async function createAuthHandoff(userId: string, tokenHash: string, expiresAt: Date) {
  return prisma.authHandoff.create({ data: { userId, tokenHash, expiresAt } });
}

export async function upsertGoogleConnectedAccount(params: {
  userId: string;
  providerConfigId: string;
  providerAccountId: string;
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  accessToken: string;
  refreshTokenEncrypted: string;
  tokenExpiryDate?: number | null;
  scopes: string[];
}) {
  const shared = {
    providerConfigId: params.providerConfigId,
    email: params.email,
    displayName: params.displayName,
    avatarUrl: params.avatarUrl,
    accessTokenEncrypted: encryptText(params.accessToken),
    refreshTokenEncrypted: params.refreshTokenEncrypted,
    tokenExpiresAt: new Date(params.tokenExpiryDate ?? Date.now() + 3600_000),
    scopes: params.scopes,
    status: 'connected' as const,
  };
  return prisma.connectedAccount.upsert({
    where: {
      provider_providerAccountId: {
        provider: 'google_drive',
        providerAccountId: params.providerAccountId,
      },
    },
    create: {
      userId: params.userId,
      provider: 'google_drive',
      providerAccountId: params.providerAccountId,
      ...shared,
    },
    update: shared,
  });
}
