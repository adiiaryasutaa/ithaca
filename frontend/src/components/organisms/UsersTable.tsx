import { Ban, Pencil, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/atoms/StatusBadge';
import { formatDate } from '@/lib/api';
import type { AppUser } from '@/lib/users';

export function UsersTable({
  users,
  loading,
  currentUserId,
  onCreate,
  onEdit,
  onDisable,
}: {
  users: AppUser[];
  loading: boolean;
  currentUserId?: string;
  onCreate: () => void;
  onEdit: (user: AppUser) => void;
  onDisable: (user: AppUser) => void;
}) {
  return (
    <Card className="mt-6 min-w-0 overflow-x-auto p-0">
      {loading ? (
        <p className="p-6 text-sm text-muted-foreground">Loading users...</p>
      ) : users.length === 0 ? (
        <div className="p-8 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-3 font-extrabold">No users yet</p>
          <Button className="mt-4" onClick={onCreate}>
            Add user
          </Button>
        </div>
      ) : (
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase text-muted-foreground">
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Created</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-semibold text-foreground">
                  {user.name}
                  {user.id === currentUserId ? (
                    <StatusBadge tone="primary" className="ml-2">
                      You
                    </StatusBadge>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                <td className="px-4 py-3">
                  <StatusBadge tone={user.role === 'admin' ? 'primary' : 'neutral'}>
                    {user.role}
                  </StatusBadge>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge tone={user.status === 'active' ? 'success' : 'neutral'}>
                    {user.status}
                  </StatusBadge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(user.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => onEdit(user)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    {/* Disabling yourself would lock you out; the backend refuses it too. */}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onDisable(user)}
                      disabled={user.id === currentUserId || user.status !== 'active'}
                    >
                      <Ban className="h-3.5 w-3.5" />
                      Disable
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
