import { useEffect, useState, type FormEvent } from 'react';
import { Bell, Cloud, Database, Globe, HardDrive, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/molecules/PageHeader';
import { ProfileSummary } from '@/components/molecules/ProfileSummary';
import { SettingCard } from '@/components/molecules/SettingCard';
import { BackupRestoreCard } from '@/components/organisms/BackupRestoreCard';
import { ConnectedAccountsCard } from '@/components/organisms/ConnectedAccountsCard';
import { DisconnectAccountDialog } from '@/components/organisms/DisconnectAccountDialog';
import { GoogleOAuthCredentialsCard } from '@/components/organisms/GoogleOAuthCredentialsCard';
import { ProviderConnectCard } from '@/components/organisms/ProviderConnectCard';
import {
  emptyS3Form,
  S3ConnectDialog,
  type S3FormValues,
} from '@/components/organisms/S3ConnectDialog';
import { SystemUpdateCard } from '@/components/organisms/SystemUpdateCard';
import { apiFetch } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import type { ConnectedAccount } from '@/lib/provider';

export function SettingsPage() {
  const user = getStoredUser();
  const isAdmin = user?.role === 'admin';
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [s3Open, setS3Open] = useState(false);
  const [connectingS3, setConnectingS3] = useState(false);
  const [s3Form, setS3Form] = useState<S3FormValues>(emptyS3Form);
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const [disconnectingAccountId, setDisconnectingAccountId] = useState<string | null>(null);
  const [accountToDisconnect, setAccountToDisconnect] = useState<ConnectedAccount | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState('');

  const selectedAccount =
    accounts.find((account) => account.id === selectedAccountId) ?? accounts[0] ?? null;

  async function load() {
    const data = await apiFetch<{ accounts: ConnectedAccount[] }>('/connected-accounts');
    setAccounts(data.accounts);
  }

  useEffect(() => {
    load().catch((error) =>
      toast.error(error instanceof Error ? error.message : 'Failed to load settings'),
    );
  }, []);

  useEffect(() => {
    if (accounts.length === 0) {
      setSelectedAccountId('');
      return;
    }
    if (!accounts.some((account) => account.id === selectedAccountId))
      setSelectedAccountId(accounts[0].id);
  }, [accounts, selectedAccountId]);

  // The Google connect flow runs in a popup, which posts back here when it lands on
  // /google-connected.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.data?.type !== 'GOOGLE_CONNECTED')
        return;
      if (event.data.status === 'success') {
        toast.success('Google Drive connected.');
      } else {
        toast.error('Google Drive connection failed.');
      }
      load()
        .then(() => {
          window.dispatchEvent(new Event('ithaca:storage-changed'));
        })
        .catch(() => undefined);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  async function connectDrive() {
    setConnecting(true);
    // Opened before the await so the popup is attributable to the click, otherwise the
    // browser blocks it as an unsolicited popup.
    const popup = window.open('', 'google-drive-connect', 'width=540,height=720');
    if (popup) {
      popup.document.write(
        '<html><head><title>Connecting...</title><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8fafc;color:#64748b;}</style></head><body><div style="text-align:center;"><h2>Connecting to Google...</h2><p>Please wait while we redirect you.</p></div></body></html>',
      );
    }
    try {
      const data = await apiFetch<{ url: string }>('/connected-accounts/google/connect-url');
      if (popup) {
        popup.location.href = data.url;
      } else {
        window.location.href = data.url;
      }
    } catch (error) {
      if (popup) popup.close();
      toast.error(
        error instanceof Error ? error.message : 'Failed to start Google Drive connection',
      );
    } finally {
      setConnecting(false);
    }
  }

  async function sync(accountId: string) {
    setSyncingAccountId(accountId);
    try {
      await apiFetch(`/connected-accounts/${accountId}/sync-quota`, { method: 'POST' });
      await load();
      window.dispatchEvent(new Event('ithaca:storage-changed'));
    } finally {
      setSyncingAccountId(null);
    }
  }

  async function disconnect() {
    if (!accountToDisconnect) return;
    setDisconnectingAccountId(accountToDisconnect.id);
    try {
      await apiFetch(`/connected-accounts/${accountToDisconnect.id}`, { method: 'DELETE' });
      setAccountToDisconnect(null);
      toast.success('Storage account disconnected.');
      await load();
      window.dispatchEvent(new Event('ithaca:storage-changed'));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to disconnect Google Drive account',
      );
    } finally {
      setDisconnectingAccountId(null);
    }
  }

  async function connectS3(event: FormEvent) {
    event.preventDefault();
    setConnectingS3(true);
    try {
      await apiFetch('/connected-accounts/s3', {
        method: 'POST',
        body: JSON.stringify({
          ...s3Form,
          endpoint: s3Form.endpoint || undefined,
          quotaBytes: s3Form.quotaBytes || null,
        }),
      });
      setS3Open(false);
      setS3Form(emptyS3Form);
      toast.success('S3 storage connected.');
      await load();
      window.dispatchEvent(new Event('ithaca:storage-changed'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to connect S3 storage');
    } finally {
      setConnectingS3(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Setting"
        description="Manage account and connected storage."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setS3Open(true)}>
              <Database className="h-4 w-4" />
              Connect S3
            </Button>
            <Button size="sm" onClick={connectDrive} disabled={connecting}>
              <Link2 className="h-4 w-4" />
              {connecting ? 'Connecting...' : 'Connect Drive'}
            </Button>
          </>
        }
      />
      <div className="mt-5 grid gap-4">
        <ProfileSummary user={user} />

        <div className="grid gap-3 sm:grid-cols-3">
          <SettingCard
            icon={HardDrive}
            title="Storage"
            description={`Connected accounts: ${accounts.length}`}
          />
          <SettingCard
            icon={Bell}
            title="Notifications"
            description="Email and app alerts are active."
          />
          <SettingCard icon={Globe} title="Region" description="Workspace region: local gateway." />
        </div>

        <ProviderConnectCard
          icon={Cloud}
          title="Google Drive"
          description="Connect one or more Google Drive accounts. Ithaca will route uploads to account with enough space."
          actionIcon={Link2}
          actionLabel={connecting ? 'Opening...' : 'Connect Drive'}
          disabled={connecting}
          onAction={connectDrive}
        />

        <ProviderConnectCard
          icon={Database}
          title="S3 Compatible"
          description="Connect AWS S3, Cloudflare R2, MinIO, Wasabi, Backblaze B2, or custom endpoint storage."
          actionIcon={Database}
          actionLabel="Connect S3"
          actionVariant="outline"
          onAction={() => setS3Open(true)}
        />

        <ConnectedAccountsCard
          accounts={accounts}
          selectedAccount={selectedAccount}
          syncingAccountId={syncingAccountId}
          onSelectAccount={setSelectedAccountId}
          onSync={sync}
          onDisconnect={setAccountToDisconnect}
        />

        {/* Admin-only: these all call /system/*, which is gated by requireAdmin. */}
        {isAdmin ? (
          <>
            <GoogleOAuthCredentialsCard />
            <SystemUpdateCard />
            <BackupRestoreCard />
          </>
        ) : null}
      </div>

      <S3ConnectDialog
        open={s3Open}
        values={s3Form}
        submitting={connectingS3}
        onChange={setS3Form}
        onSubmit={connectS3}
        onClose={() => setS3Open(false)}
      />
      <DisconnectAccountDialog
        account={accountToDisconnect}
        disconnecting={Boolean(disconnectingAccountId)}
        onConfirm={disconnect}
        onClose={() => setAccountToDisconnect(null)}
      />
    </>
  );
}
