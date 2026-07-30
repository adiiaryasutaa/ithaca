import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DummyModal } from '@/components/molecules/DummyModal';
import { formatBytes } from '@/lib/api';
import type { ConnectedAccount } from '@/lib/provider';

export function DisconnectAccountDialog({
  account,
  disconnecting,
  onConfirm,
  onClose,
}: {
  account: ConnectedAccount | null;
  disconnecting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <DummyModal
      open={Boolean(account)}
      title="Disconnect storage?"
      description="This will remove this storage account from Ithaca. Existing file records for this account may no longer be usable."
      onClose={onClose}
    >
      <div className="grid gap-4">
        <div className="rounded-sm bg-muted p-4 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">{account?.email}</p>
          <p className="mt-1">Used storage: {formatBytes(account?.storageAccount?.usedBytes)}</p>
        </div>
        <div className="grid gap-3 sm:flex sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={disconnecting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={disconnecting}>
            <Trash2 className="h-4 w-4" />
            {disconnecting ? 'Disconnecting...' : 'Disconnect'}
          </Button>
        </div>
      </div>
    </DummyModal>
  );
}
