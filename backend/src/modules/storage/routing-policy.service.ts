import { prisma } from '../../config/prisma.js';

/**
 * Ithaca is a single shared workspace, so there is one routing policy row for the
 * whole app rather than one per user. `createdByUserId` only fills the NOT NULL
 * owner column the first time the singleton is created.
 */
export async function getOrCreateRoutingPolicy(createdByUserId: string) {
  const existing = await prisma.uploadRoutingPolicy.findFirst({ orderBy: { createdAt: 'asc' } });
  if (existing) return existing;
  return prisma.uploadRoutingPolicy.create({
    data: { userId: createdByUserId, mode: 'most_available', priorityAccountIds: [] },
  });
}

export function normalizePriorityAccountIds(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}
