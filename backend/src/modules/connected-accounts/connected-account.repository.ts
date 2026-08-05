import { prisma } from '../../config/prisma.js';
import { randomToken } from '../../utils/crypto.js';
import { hashPassword } from '../../utils/password.js';

export function findConnectedAccountsWithStorageOrdered() {
  return prisma.connectedAccount.findMany({
    where: { status: 'connected' },
    include: { storageAccount: true },
    orderBy: { createdAt: 'desc' },
  });
}

export function findGoogleProviderConfigById(id: string) {
  return prisma.providerConfig.findFirstOrThrow({
    where: { id, provider: 'google_drive', status: 'active' },
  });
}

export function findActiveGlobalGoogleProviderConfig() {
  return prisma.providerConfig.findFirstOrThrow({
    where: { userId: null, provider: 'google_drive', status: 'active' },
    orderBy: { createdAt: 'desc' },
  });
}

export async function upsertUserByEmail(email: string, name: string) {
  return prisma.user.upsert({
    where: { email },
    create: { email, name, passwordHash: await hashPassword(randomToken(32)) },
    update: { name },
  });
}

export function findConnectedAccountByIdOrThrow(id: string) {
  return prisma.connectedAccount.findFirstOrThrow({ where: { id } });
}

export function disconnectAccount(id: string) {
  return prisma.connectedAccount.updateMany({
    where: { id },
    data: { status: 'disconnected' },
  });
}
