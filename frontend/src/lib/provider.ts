import { formatBytes } from '@/lib/api';

export type ConnectedAccount = {
  id: string;
  provider: string;
  email: string;
  displayName?: string | null;
  status: string;
  storageAccount?: {
    totalBytes: string | null;
    usedBytes: string;
    availableBytes: string | null;
    lastSyncedAt: string | null;
  } | null;
};

export function providerLabel(provider: string) {
  if (provider === 's3') return 'S3 Storage';
  return 'Google Drive';
}

// S3 buckets have no quota API, so a null total means "no configured limit" rather than
// "zero bytes" — formatBytes would otherwise render that as 0 B.
export function storageLimitLabel(account: ConnectedAccount) {
  if (account.provider === 's3' && account.storageAccount?.totalBytes === null) return 'Unlimited';
  return formatBytes(account.storageAccount?.totalBytes);
}

export function availableLabel(account: ConnectedAccount) {
  if (account.provider === 's3' && account.storageAccount?.availableBytes === null)
    return 'Unlimited';
  return formatBytes(account.storageAccount?.availableBytes);
}

export function usedPercent(account: ConnectedAccount) {
  const total = Number(account.storageAccount?.totalBytes ?? 0);
  const used = Number(account.storageAccount?.usedBytes ?? 0);
  return total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
}
