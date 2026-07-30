import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ProviderIcon } from '@/components/atoms/ProviderIcon';
import { formatBytes } from '@/lib/api';
import { availableLabel, providerLabel, type ConnectedAccount } from '@/lib/provider';

export type RoutingMode = 'most_available' | 'round_robin' | 'priority';
export type RoutingPolicy = {
  mode: RoutingMode;
  priorityAccountIds: string[];
  roundRobinCursor: number;
};

const routingModes: Record<RoutingMode, string> = {
  most_available: 'Most available',
  round_robin: 'Round robin',
  priority: 'Priority order',
};

/**
 * The account order shown here IS the priority list: accounts named in
 * `priorityAccountIds` come first in that order, then everything else.
 */
export function orderAccountsByPriority(
  accounts: ConnectedAccount[],
  priorityAccountIds: string[],
) {
  const byId = new Map(accounts.map((account) => [account.id, account]));
  const ordered = priorityAccountIds
    .map((id) => byId.get(id))
    .filter((account): account is ConnectedAccount => Boolean(account));
  const orderedIds = new Set(ordered.map((account) => account.id));
  return [...ordered, ...accounts.filter((account) => !orderedIds.has(account.id))];
}

export function UploadRoutingCard({
  accounts,
  policy,
  onModeChange,
  onMoveAccount,
}: {
  accounts: ConnectedAccount[];
  policy: RoutingPolicy;
  onModeChange: (mode: RoutingMode) => void;
  onMoveAccount: (accountId: string, direction: -1 | 1) => void;
}) {
  const ordered = orderAccountsByPriority(accounts, policy.priorityAccountIds);

  return (
    <Card className="mt-6 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-extrabold">Upload Routing</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose how new uploads pick connected storage accounts.
          </p>
        </div>
        <label className="grid gap-2 text-sm font-semibold lg:w-64">
          Routing mode
          <Select
            items={routingModes}
            value={policy.mode}
            onValueChange={(mode) => onModeChange(mode as RoutingMode)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(routingModes).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>
      <div className="mt-4 grid gap-3">
        {ordered.map((account, index) => (
          <div
            key={account.id}
            className="flex flex-col gap-3 rounded-sm bg-muted p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-card text-primary">
                <ProviderIcon provider={account.provider} />
              </div>
              <div>
                <p className="font-semibold">{account.displayName || account.email}</p>
                <p className="text-sm text-muted-foreground">
                  {providerLabel(account.provider)} ·{' '}
                  {formatBytes(account.storageAccount?.usedBytes)} used · {availableLabel(account)}{' '}
                  free
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onMoveAccount(account.id, -1)}
                disabled={index === 0}
              >
                Up
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onMoveAccount(account.id, 1)}
                disabled={index === accounts.length - 1}
              >
                Down
              </Button>
            </div>
          </div>
        ))}
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Connect storage accounts to configure routing.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
