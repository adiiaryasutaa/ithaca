import { prisma } from '../../config/prisma.js';

export function findActiveGlobalGoogleConfig() {
  return prisma.providerConfig.findFirst({
    where: { userId: null, provider: 'google_drive', status: 'active' },
    orderBy: { createdAt: 'desc' },
  });
}

export function disableActiveGlobalGoogleConfigs() {
  return prisma.providerConfig.updateMany({
    where: { userId: null, provider: 'google_drive', status: 'active' },
    data: { status: 'disabled' },
  });
}

export function findDisabledGlobalGoogleConfig() {
  return prisma.providerConfig.findFirst({
    where: { userId: null, provider: 'google_drive', status: 'disabled' },
    orderBy: { createdAt: 'desc' },
  });
}

export function createGlobalGoogleConfig(data: {
  clientIdEncrypted: string;
  clientSecretEncrypted: string;
  redirectUri: string;
  scopes: string[];
}) {
  return prisma.providerConfig.create({
    data: { ...data, userId: null, provider: 'google_drive', status: 'active' },
  });
}

export function disconnectPrisma() {
  return prisma.$disconnect();
}
