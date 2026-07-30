import { useEffect, useState } from 'react';
import { Clock, UserCheck, Users } from 'lucide-react';
import { toast } from 'sonner';
import { MetricCard } from '@/components/molecules/MetricCard';
import { PageHeader } from '@/components/molecules/PageHeader';
import { InviteList, type Invite } from '@/components/organisms/InviteList';
import { apiFetch } from '@/lib/api';

export function SharedPage() {
  const [sentInvites, setSentInvites] = useState<Invite[]>([]);
  const [receivedInvites, setReceivedInvites] = useState<Invite[]>([]);
  const pendingCount = sentInvites.filter((invite) => invite.status === 'pending').length;
  const acceptedCount = sentInvites.filter((invite) => invite.status === 'accepted').length;

  async function loadInvites() {
    const data = await apiFetch<{ sent: Invite[]; received: Invite[] }>('/invites');
    setSentInvites(data.sent);
    setReceivedInvites(data.received);
  }

  useEffect(() => {
    loadInvites().catch((error) =>
      toast.error(error instanceof Error ? error.message : 'Failed to load shared resources'),
    );
    // AllFilesPage dispatches this after sending an invite from a context menu.
    window.addEventListener('ithaca:invites-changed', loadInvites);
    return () => window.removeEventListener('ithaca:invites-changed', loadInvites);
  }, []);

  async function revokeInvite(id: string) {
    await apiFetch(`/invites/${id}`, { method: 'DELETE' });
    await loadInvites();
  }

  return (
    <>
      <PageHeader
        title="Shared"
        description="Files and folders shared with members or shared with you."
      />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Shared Resources"
          value={String(sentInvites.length + receivedInvites.length)}
          icon={Users}
        />
        <MetricCard label="Accepted Members" value={String(acceptedCount)} icon={UserCheck} />
        <MetricCard label="Pending Invites" value={String(pendingCount)} icon={Clock} />
      </div>

      <InviteList
        className="mt-8"
        title="Shared With You"
        direction="received"
        invites={receivedInvites}
        emptyMessage="No files or folders have been shared with you yet."
      />

      <InviteList
        className="mt-6"
        title="Resources You Shared"
        direction="sent"
        invites={sentInvites}
        emptyMessage="No files or folders shared yet. Use Invite Members from the top bar."
        onRevoke={revokeInvite}
      />
    </>
  );
}
