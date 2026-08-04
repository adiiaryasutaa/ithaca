import { syncGoogleQuota } from '../google/google.service.js';
import { syncS3Quota } from '../s3/s3.service.js';

export function syncQuotaForAccount(account: { id: string; provider: string }) {
  if (account.provider === 's3') return syncS3Quota(account.id);
  return syncGoogleQuota(account.id);
}
