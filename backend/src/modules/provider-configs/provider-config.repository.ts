import { prisma } from '../../config/prisma.js';

export function createGoogleProviderConfig(data: {
  userId: string;
  clientIdEncrypted: string;
  clientSecretEncrypted: string;
  redirectUri: string;
  scopes: string[];
}) {
  return prisma.providerConfig.create({ data: { ...data, provider: 'google_drive' } });
}

export function findAllProviderConfigs() {
  return prisma.providerConfig.findMany({
    select: {
      id: true,
      provider: true,
      redirectUri: true,
      scopes: true,
      status: true,
      createdAt: true,
    },
  });
}

export function deleteProviderConfigById(id: string) {
  return prisma.providerConfig.deleteMany({ where: { id } });
}
