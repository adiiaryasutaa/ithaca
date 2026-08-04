import { prisma } from '../../config/prisma.js';

export function findEnabledShareByTokenOrHash(token: string, tokenHash: string) {
  return prisma.fileShare.findFirst({
    where: {
      enabled: true,
      AND: [
        { OR: [{ token }, { tokenHash }] },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      ],
    },
    include: { file: { include: { connectedAccount: true } } },
  });
}
