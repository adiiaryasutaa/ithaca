import { FileArchive, Folder, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatBytes, formatDate } from '@/lib/api';
import { cn } from '@/lib/utils';

export type Invite = {
  id: string;
  email: string;
  role: string;
  status: string;
  targetType: string;
  createdAt: string;
  target?: { name: string; sizeBytes?: string | null } | null;
};

function ResourceIcon({ type }: { type: string }) {
  const Icon = type === 'folder' ? Folder : FileArchive;
  return <Icon className="h-5 w-5 shrink-0 text-primary" />;
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'w-fit rounded-full px-3 py-1 text-xs font-bold capitalize',
        status === 'accepted' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-50 text-amber-700',
      )}
    >
      {status}
    </span>
  );
}

/**
 * Both directions of sharing render the same row; only the secondary line and the actions
 * differ — received invites show what was shared, sent invites show who it went to.
 */
export function InviteList({
  title,
  invites,
  emptyMessage,
  direction,
  className,
  onRevoke,
}: {
  title: string;
  invites: Invite[];
  emptyMessage: string;
  direction: 'received' | 'sent';
  className?: string;
  onRevoke?: (id: string) => void;
}) {
  return (
    <Card className={cn('p-5', className)}>
      <h2 className="font-extrabold">{title}</h2>
      <div className="grid gap-3">
        {invites.length === 0 ? (
          <p className="rounded-sm bg-muted p-4 text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          invites.map((invite) => (
            <div
              key={invite.id}
              className="flex flex-col gap-3 rounded-sm bg-muted p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <ResourceIcon type={invite.targetType} />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">
                    {invite.target?.name ?? 'Unavailable resource'}
                  </p>
                  {direction === 'received' ? (
                    <p className="text-sm text-muted-foreground capitalize">
                      {invite.targetType} • {invite.role}
                      {invite.target?.sizeBytes ? ` • ${formatBytes(invite.target.sizeBytes)}` : ''}
                    </p>
                  ) : (
                    <>
                      <p className="break-all text-sm text-muted-foreground">
                        Shared with {invite.email}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Invited {formatDate(invite.createdAt)}
                      </p>
                    </>
                  )}
                </div>
              </div>
              {direction === 'received' ? (
                <StatusPill status={invite.status} />
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-card px-3 py-1 text-xs font-bold capitalize text-muted-foreground">
                    {invite.role}
                  </span>
                  <StatusPill status={invite.status} />
                  <Button variant="destructive" size="sm" onClick={() => onRevoke?.(invite.id)}>
                    <Trash2 className="h-4 w-4" />
                    Revoke
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
