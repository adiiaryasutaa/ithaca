import { prisma } from '../../config/prisma.js';
import type { S3StorageConfig } from '@prisma/client';

export function findActiveS3ConfigForAccount(accountId: string) {
  return prisma.s3StorageConfig.findFirstOrThrow({
    where: { connectedAccountId: accountId, status: 'active' },
  });
}

export function upsertS3StorageAccountQuota(
  accountId: string,
  data: { totalBytes: bigint | null; usedBytes: bigint; availableBytes: bigint | null },
) {
  return prisma.storageAccount.upsert({
    where: { connectedAccountId: accountId },
    create: { connectedAccountId: accountId, ...data, lastSyncedAt: new Date() },
    update: { ...data, lastSyncedAt: new Date() },
  });
}

export function findActiveGoogleProviderConfig() {
  return prisma.providerConfig.findFirstOrThrow({
    where: { provider: 'google_drive', status: 'active' },
    orderBy: { createdAt: 'desc' },
  });
}

export function findS3ConnectedAccountByProviderAccountId(providerAccountId: string) {
  return prisma.connectedAccount.findUnique({
    where: { provider_providerAccountId: { provider: 's3', providerAccountId } },
  });
}

export type S3ConnectedAccountFields = {
  providerConfigId: string;
  email: string;
  displayName: string;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
  tokenExpiresAt: Date;
};

export function updateS3ConnectedAccount(id: string, data: S3ConnectedAccountFields) {
  return prisma.connectedAccount.update({
    where: { id },
    data: { ...data, scopes: [], status: 'connected' },
  });
}

export function createS3ConnectedAccount(
  userId: string,
  providerAccountId: string,
  data: S3ConnectedAccountFields,
) {
  return prisma.connectedAccount.create({
    data: {
      userId,
      provider: 's3',
      providerAccountId,
      ...data,
      scopes: [],
      status: 'connected',
    },
  });
}

export function deleteConnectedAccount(id: string) {
  return prisma.connectedAccount.delete({ where: { id } }).catch(() => undefined);
}

export type S3StorageConfigFields = {
  name: string;
  bucket: string;
  region: string;
  endpoint: string | null;
  accessKeyIdEncrypted: string;
  secretAccessKeyEncrypted: string;
  forcePathStyle: boolean;
  quotaBytes: bigint | null;
};

export function upsertS3StorageConfig(
  userId: string,
  connectedAccountId: string,
  data: S3StorageConfigFields,
): Promise<S3StorageConfig> {
  return prisma.s3StorageConfig.upsert({
    where: { connectedAccountId },
    create: { userId, connectedAccountId, ...data },
    update: { ...data, status: 'active' },
  });
}
