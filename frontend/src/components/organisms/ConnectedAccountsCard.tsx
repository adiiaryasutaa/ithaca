import { RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { formatBytes } from '@/lib/api';
import { availableLabel, providerLabel, storageLimitLabel } from '@/lib/provider';
import type { ConnectedAccount } from '@/lib/provider';

export function ConnectedAccountsCard({
  accounts,
  selectedAccount,
  syncingAccountId,
  onSelectAccount,
  onSync,
  onDisconnect,
}: {
  accounts: ConnectedAccount[];
  selectedAccount: ConnectedAccount | null;
  syncingAccountId: string | null;
  onSelectAccount: (accountId: string) => void;
  onSync: (accountId: string) => void;
  onDisconnect: (account: ConnectedAccount) => void;
}) {
  const syncing = Boolean(selectedAccount && syncingAccountId === selectedAccount.id);
  return (
    <Card className="p-4">
      <h2 className="text-[16px] font-bold">Connected Storage Accounts</h2>
      <div className="mt-3.5 grid gap-3">
        {accounts.length === 0 ? (
          <p className="text-xs text-muted-foreground">No connected storage account yet.</p>
        ) : (
          <>
            <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
              Choose Account
              <Combobox
                className="h-7"
                value={selectedAccount?.id ?? ''}
                onValueChange={onSelectAccount}
                options={accounts.map((account) => ({
                  value: account.id,
                  label: `${providerLabel(account.provider)} - ${account.displayName || account.email} (${account.status})`,
                }))}
              />
            </label>
            {selectedAccount ? (
              <div className="rounded-sm bg-muted p-3 dark:bg-slate-900 border border-border dark:border-slate-800">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-all font-semibold text-sm">
                      {selectedAccount.displayName || selectedAccount.email}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {providerLabel(selectedAccount.provider)} · {selectedAccount.status}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:flex">
                    <Button
                      className="w-full sm:w-auto"
                      size="sm"
                      variant="outline"
                      onClick={() => onSync(selectedAccount.id)}
                      disabled={syncing}
                    >
                      <RefreshCw className={syncing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                      {syncing ? 'Syncing...' : 'Sync'}
                    </Button>
                    <Button
                      className="w-full sm:w-auto"
                      size="sm"
                      variant="destructive"
                      onClick={() => onDisconnect(selectedAccount)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Disconnect
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <QuotaCell
                    label="Used"
                    value={formatBytes(selectedAccount.storageAccount?.usedBytes)}
                  />
                  <QuotaCell label="Total" value={storageLimitLabel(selectedAccount)} />
                  <QuotaCell label="Free" value={availableLabel(selectedAccount)} />
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </Card>
  );
}

function QuotaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm bg-card dark:bg-slate-950 p-2 border border-border dark:border-slate-800">
      <p className="font-extrabold text-foreground">{value}</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
