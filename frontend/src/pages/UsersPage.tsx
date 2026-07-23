import { useEffect, useState, type FormEvent } from 'react';
import { UserPlus, Pencil, Ban, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/drive/PageHeader';
import { apiFetch, formatDate } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { cn } from '@/lib/utils';

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  name: string;
  email: string;
  password: string;
  role: string;
  status: string;
};

const emptyForm: FormState = {
  name: '',
  email: '',
  password: '',
  role: 'user',
  status: 'active',
};

export function UsersPage() {
  const currentUserId = getStoredUser()?.id;
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<{ users: User[] }>('/users');
      setUsers(data.users);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(user: User) {
    setEditing(user);
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      status: user.status,
    });
    setDialogOpen(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        const body: Record<string, string> = {
          name: form.name,
          email: form.email,
          role: form.role,
          status: form.status,
        };
        if (form.password) body.password = form.password;
        await apiFetch(`/users/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) });
        toast.success('User updated');
      } else {
        await apiFetch('/users', {
          method: 'POST',
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            password: form.password,
            role: form.role,
          }),
        });
        toast.success('User created');
      }
      setDialogOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save user');
    } finally {
      setSaving(false);
    }
  }

  async function disableUser(user: User) {
    if (!confirm(`Disable ${user.email}? They will no longer be able to sign in.`)) return;
    try {
      await apiFetch(`/users/${user.id}`, { method: 'DELETE' });
      toast.success('User disabled');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to disable user');
    }
  }

  return (
    <>
      <PageHeader
        title="Users"
        description="Manage dashboard accounts, roles, and access."
        actions={
          <Button onClick={openCreate}>
            <UserPlus className="h-4 w-4" />
            Add user
          </Button>
        }
      />

      <Card className="mt-6 min-w-0 overflow-x-auto p-0">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading users...</p>
        ) : users.length === 0 ? (
          <div className="p-8 text-center">
            <ShieldCheck className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-3 font-extrabold">No users yet</p>
            <Button className="mt-4" onClick={openCreate}>
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
                      <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                        You
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-bold',
                        user.role === 'admin'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-accent text-muted-foreground',
                      )}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-bold',
                        user.status === 'active'
                          ? 'bg-emerald-100 text-emerald-600'
                          : 'bg-accent text-muted-foreground',
                      )}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(user)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => disableUser(user)}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit user' : 'Add user'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Update account details, role, or status.'
                : 'Create a new dashboard account.'}
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="user-name">Name</Label>
              <Input
                id="user-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
                minLength={2}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-password">
                Password{' '}
                {editing ? (
                  <span className="text-muted-foreground">(leave blank to keep)</span>
                ) : null}
              </Label>
              <Input
                id="user-password"
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                required={!editing}
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="user-role">Role</Label>
                <Combobox
                  id="user-role"
                  value={form.role}
                  onValueChange={(role) => setForm({ ...form, role })}
                  options={[
                    { value: 'user', label: 'user' },
                    { value: 'admin', label: 'admin' },
                  ]}
                />
              </div>
              {editing ? (
                <div className="grid gap-2">
                  <Label htmlFor="user-status">Status</Label>
                  <Combobox
                    id="user-status"
                    value={form.status}
                    onValueChange={(status) => setForm({ ...form, status })}
                    options={[
                      { value: 'active', label: 'active' },
                      { value: 'disabled', label: 'disabled' },
                    ]}
                  />
                </div>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : editing ? 'Save changes' : 'Create user'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
