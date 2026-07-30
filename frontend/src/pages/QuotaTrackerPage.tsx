import { useEffect, useState } from 'react';
import { CheckCircle, Cloud, Filter, Gauge, Link2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/molecules/EmptyState';
import { MetricCard } from '@/components/molecules/MetricCard';
import { PageHeader } from '@/components/molecules/PageHeader';
import { AccountQuotaCard } from '@/components/organisms/AccountQuotaCard';
import {
  orderAccountsByPriority,
  UploadRoutingCard,
  type RoutingMode,
  type RoutingPolicy,
} from '@/components/organisms/UploadRoutingCard';
import { apiFetch, formatBytes } from '@/lib/api';
import { openGoogleConnectPopup } from '@/lib/google-connect';
import type { ConnectedAccount } from '@/lib/provider';

type StorageSummary = { totalBytes: string; usedBytes: string; availableBytes: string };

const AUTO_REFRESH_INTERVAL_MS = 35_000;

export function QuotaTrackerPage() {
  const [summary, setSummary] = useState<StorageSummary | null>(null);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [routingPolicy, setRoutingPolicy] = useState<RoutingPolicy>({
    mode: 'most_available',
    priorityAccountIds: [],
    roundRobinCursor: 0,
  });
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);

  async function load() {
    const [summaryData, accountData, policyData] = await Promise.all([
      apiFetch<StorageSummary>('/storage/summary'),
      apiFetch<{ accounts: ConnectedAccount[] }>('/connected-accounts'),
      apiFetch<{ policy: RoutingPolicy }>('/storage/routing-policy'),
    ]);
    setSummary(summaryData);
    setAccounts(accountData.accounts);
    setRoutingPolicy(policyData.policy);
  }

  async function refresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load().catch((error) =>
      toast.error(error instanceof Error ? error.message : 'Failed to load quota tracker'),
    );
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => load().catch(() => undefined), AUTO_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [autoRefresh]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.data?.type !== 'GOOGLE_CONNECTED')
        return;
      if (event.data.status === 'success') {
        toast.success('Google Drive connected.');
      } else {
        toast.error('Google Drive connection failed.');
      }
      load().catch(() => undefined);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  function connectDrive() {
    openGoogleConnectPopup().catch((e) =>
      console.error('Failed to start Google Drive connection from Quota Tracker', e),
    );
  }

  async function sync(accountId: string) {
    setSyncingAccountId(accountId);
    try {
      await apiFetch(`/connected-accounts/${accountId}/sync-quota`, { method: 'POST' });
      await load();
    } finally {
      setSyncingAccountId(null);
    }
  }

  async function saveRoutingPolicy(nextPolicy: RoutingPolicy) {
    setRoutingPolicy(nextPolicy);
    const data = await apiFetch<{ policy: RoutingPolicy }>('/storage/routing-policy', {
      method: 'PATCH',
      body: JSON.stringify({
        mode: nextPolicy.mode,
        priorityAccountIds: nextPolicy.priorityAccountIds,
      }),
    });
    setRoutingPolicy(data.policy);
    toast.success('Upload routing policy updated.');
  }

  function saveOrToast(nextPolicy: RoutingPolicy) {
    saveRoutingPolicy(nextPolicy).catch((error) =>
      toast.error(error instanceof Error ? error.message : 'Failed to update routing policy'),
    );
  }

  function moveAccount(accountId: string, direction: -1 | 1) {
    const ids = orderAccountsByPriority(accounts, routingPolicy.priorityAccountIds).map(
      (account) => account.id,
    );
    const index = ids.indexOf(accountId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    const nextIds = [...ids];
    const [item] = nextIds.splice(index, 1);
    nextIds.splice(target, 0, item);
    saveOrToast({ ...routingPolicy, priorityAccountIds: nextIds });
  }

  return (
    <>
      <PageHeader
        title="Quota Tracker"
        description="Track and manage connected provider storage limits."
        actions={
          <>
            <Button variant="outline" onClick={() => setAutoRefresh(!autoRefresh)}>
              <CheckCircle className="h-4 w-4" />
              Auto-refresh {autoRefresh ? 'On' : 'Off'}
            </Button>
            <Button variant="outline" onClick={refresh} disabled={refreshing}>
              <RefreshCw className={refreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button onClick={connectDrive}>
              <Link2 className="h-4 w-4" />
              Connect Drive
            </Button>
          </>
        }
      />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <MetricCard label="Total Storage" value={formatBytes(summary?.totalBytes)} />
        <MetricCard label="Used Storage" value={formatBytes(summary?.usedBytes)} />
        <MetricCard label="Available" value={formatBytes(summary?.availableBytes)} />
        <MetricCard label="Accounts" value={accounts.length} />
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button variant="outline">
          <Filter className="h-4 w-4" />
          All Providers
        </Button>
        <Button variant="outline">All Accounts</Button>
        <Button variant="secondary">
          <Gauge className="h-4 w-4" />
          Most available
        </Button>
      </div>

      <UploadRoutingCard
        accounts={accounts}
        policy={routingPolicy}
        onModeChange={(mode: RoutingMode) => saveOrToast({ ...routingPolicy, mode })}
        onMoveAccount={moveAccount}
      />

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {accounts.length === 0 ? (
          <EmptyState
            className="col-span-full p-8"
            icon={<Cloud className="h-10 w-10 text-primary" />}
            title="No connected drives"
            message="Connect Google Drive or S3-compatible storage to start tracking quota."
            actions={
              <Button onClick={connectDrive}>
                <Link2 className="h-4 w-4" />
                Connect Drive
              </Button>
            }
          />
        ) : (
          accounts.map((account) => (
            <AccountQuotaCard
              key={account.id}
              account={account}
              syncing={syncingAccountId === account.id}
              onSync={() => sync(account.id)}
            />
          ))
        )}
      </div>
    </>
  );
}
