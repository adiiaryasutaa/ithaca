import { prisma } from '../../config/prisma.js';

export type BreakdownRow = { kind: string; bytes: bigint | number | string | null };

export function findConnectedAccountsWithStorage() {
  return prisma.connectedAccount.findMany({
    where: { status: 'connected' },
    include: { storageAccount: true },
  });
}

export function findConnectedAccountIds(ids: string[]) {
  return prisma.connectedAccount.findMany({
    where: { id: { in: ids }, status: 'connected' },
    select: { id: true },
  });
}

export function updateRoutingPolicyRow(
  id: string,
  data: {
    mode: 'most_available' | 'round_robin' | 'priority';
    priorityAccountIds: string[];
    roundRobinCursor?: number;
  },
) {
  return prisma.uploadRoutingPolicy.update({ where: { id }, data });
}

export function queryFileSizeBreakdown() {
  return prisma.$queryRaw<BreakdownRow[]>`
    SELECT
      CASE
        WHEN mime_type ILIKE 'image/%' THEN 'photo'
        WHEN mime_type ILIKE 'video/%' THEN 'video'
        ELSE 'document'
      END AS kind,
      COALESCE(SUM(size_bytes), 0) AS bytes
    FROM files
    WHERE status = 'active'
    GROUP BY kind
  `;
}
