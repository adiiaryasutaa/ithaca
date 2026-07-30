import { useEffect, useState, type FormEvent } from 'react';
import { UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/molecules/PageHeader';
import { UserFormDialog } from '@/components/organisms/UserFormDialog';
import { UsersTable } from '@/components/organisms/UsersTable';
import { apiFetch } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { confirmToast } from '@/lib/confirm-toast';
import { emptyUserForm, type AppUser, type UserFormValues } from '@/lib/users';

export function UsersPage() {
  const currentUserId = getStoredUser()?.id;
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [form, setForm] = useState<UserFormValues>(emptyUserForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<{ users: AppUser[] }>('/users');
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
    setForm(emptyUserForm);
    setDialogOpen(true);
  }

  function openEdit(user: AppUser) {
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
        // An empty password field means "keep the current one", so it is omitted entirely.
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

  async function performDisable(user: AppUser) {
    try {
      await apiFetch(`/users/${user.id}`, { method: 'DELETE' });
      toast.success('User disabled');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to disable user');
    }
  }

  function disableUser(user: AppUser) {
    confirmToast(
      `Disable ${user.email}? They will no longer be able to sign in.`,
      () => performDisable(user),
      'Disable',
    );
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

      <UsersTable
        users={users}
        loading={loading}
        currentUserId={currentUserId}
        onCreate={openCreate}
        onEdit={openEdit}
        onDisable={disableUser}
      />

      <UserFormDialog
        open={dialogOpen}
        editing={Boolean(editing)}
        values={form}
        saving={saving}
        onChange={setForm}
        onSubmit={handleSubmit}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
