import type { StorageAccount } from '@prisma/client';
import * as storageRepository from './storage.repository.js';
import { getOrCreateRoutingPolicy, normalizePriorityAccountIds } from './routing-policy.service.js';

function bytesToString(value: bigint | number | string | null | undefined) {
  if (value === null || value === undefined) return '0';
  return value.toString();
}

export function serializeStorageAccount(storageAccount: StorageAccount | null | undefined) {
  if (!storageAccount) return null;
  return {
    ...storageAccount,
    totalBytes: storageAccount.totalBytes?.toString() ?? null,
    usedBytes: storageAccount.usedBytes.toString(),
    availableBytes: storageAccount.availableBytes?.toString() ?? null,
    trashBytes: storageAccount.trashBytes?.toString() ?? null,
  };
}

export async function getStorageSummary() {
  const accounts = await storageRepository.findConnectedAccountsWithStorage();
  const summary = accounts.reduce(
    (acc, account) => {
      const storage = account.storageAccount;
      acc.totalBytes += storage?.totalBytes ?? 0n;
      acc.usedBytes += storage?.usedBytes ?? 0n;
      acc.availableBytes += storage?.availableBytes ?? 0n;
      return acc;
    },
    { totalBytes: 0n, usedBytes: 0n, availableBytes: 0n },
  );

  return {
    totalBytes: summary.totalBytes.toString(),
    usedBytes: summary.usedBytes.toString(),
    availableBytes: summary.availableBytes.toString(),
    accounts: accounts.map((account) => ({
      id: account.id,
      provider: account.provider,
      email: account.email,
      status: account.status,
      totalBytes: account.storageAccount?.totalBytes?.toString() ?? null,
      usedBytes: account.storageAccount?.usedBytes.toString() ?? '0',
      availableBytes: account.storageAccount?.availableBytes?.toString() ?? null,
      lastSyncedAt: account.storageAccount?.lastSyncedAt ?? null,
    })),
  };
}

export async function getRoutingPolicy(userId: string) {
  const policy = await getOrCreateRoutingPolicy(userId);
  return {
    id: policy.id,
    mode: policy.mode,
    priorityAccountIds: normalizePriorityAccountIds(policy.priorityAccountIds),
    roundRobinCursor: policy.roundRobinCursor,
  };
}

export async function updateRoutingPolicy(
  userId: string,
  body: { mode: 'most_available' | 'round_robin' | 'priority'; priorityAccountIds?: string[] },
) {
  const accountIds = [...new Set(body.priorityAccountIds ?? [])];
  const validAccounts =
    accountIds.length === 0 ? [] : await storageRepository.findConnectedAccountIds(accountIds);
  const validIds = new Set(validAccounts.map((account) => account.id));
  const priorityAccountIds = accountIds.filter((id) => validIds.has(id));
  const current = await getOrCreateRoutingPolicy(userId);
  const policy = await storageRepository.updateRoutingPolicyRow(current.id, {
    mode: body.mode,
    priorityAccountIds,
    ...(body.mode !== 'round_robin' ? { roundRobinCursor: 0 } : {}),
  });
  return {
    id: policy.id,
    mode: policy.mode,
    priorityAccountIds: normalizePriorityAccountIds(policy.priorityAccountIds),
    roundRobinCursor: policy.roundRobinCursor,
  };
}

export async function getStorageBreakdown() {
  const rows = await storageRepository.queryFileSizeBreakdown();
  const breakdown = { photo: '0', video: '0', document: '0' };
  for (const row of rows) {
    if (row.kind === 'photo' || row.kind === 'video' || row.kind === 'document')
      breakdown[row.kind] = bytesToString(row.bytes);
  }
  return breakdown;
}
