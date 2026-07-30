import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ProviderIcon } from '@/components/atoms/ProviderIcon';
import { QuotaBar } from '@/components/molecules/QuotaBar';
import { formatBytes } from '@/lib/api';
import {
  availableLabel,
  providerLabel,
  storageLimitLabel,
  usedPercent,
  type ConnectedAccount,
} from '@/lib/provider';

export function AccountQuotaCard({
  account,
  syncing,
  onSync,
}: {
  account: ConnectedAccount;
  syncing: boolean;
  onSync: () => void;
}) {
  return (
    <Card className="overflow-hidden p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-sm bg-primary text-white">
            <ProviderIcon provider={account.provider} />
          </div>
          <div>
            <h2 className="font-extrabold">{providerLabel(account.provider)}</h2>
            <p className="text-sm text-muted-foreground">{account.email}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={onSync} disabled={syncing}>
            <RefreshCw className={syncing ? 'h-5 w-5 animate-spin' : 'h-5 w-5'} />
          </Button>
        </div>
      </div>
      <div className="mt-6">
        <QuotaBar
          percent={usedPercent(account)}
          footerLeft={`${formatBytes(account.storageAccount?.usedBytes)} / ${storageLimitLabel(account)}`}
          footerRight={`Available ${availableLabel(account)}`}
        />
      </div>
    </Card>
  );
}
