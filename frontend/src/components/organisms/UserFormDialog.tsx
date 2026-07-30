import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { UserFormValues } from '@/lib/users';

export function UserFormDialog({
  open,
  editing,
  values,
  saving,
  onChange,
  onSubmit,
  onOpenChange,
}: {
  open: boolean;
  editing: boolean;
  values: UserFormValues;
  saving: boolean;
  onChange: (values: UserFormValues) => void;
  onSubmit: (event: FormEvent) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const set = <K extends keyof UserFormValues>(key: K, value: UserFormValues[K]) =>
    onChange({ ...values, [key]: value });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit user' : 'Add user'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Update account details, role, or status.'
              : 'Create a new dashboard account.'}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="user-name">Name</Label>
            <Input
              id="user-name"
              value={values.name}
              onChange={(event) => set('name', event.target.value)}
              required
              minLength={2}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="user-email">Email</Label>
            <Input
              id="user-email"
              type="email"
              value={values.email}
              onChange={(event) => set('email', event.target.value)}
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
              value={values.password}
              onChange={(event) => set('password', event.target.value)}
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
                searchable={false}
                value={values.role}
                onValueChange={(role) => set('role', role)}
                options={[
                  { value: 'user', label: 'user' },
                  { value: 'admin', label: 'admin' },
                ]}
              />
            </div>
            {/* Status is only meaningful on an existing account — new ones start active. */}
            {editing ? (
              <div className="grid gap-2">
                <Label htmlFor="user-status">Status</Label>
                <Combobox
                  id="user-status"
                  searchable={false}
                  value={values.status}
                  onValueChange={(status) => set('status', status)}
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
              onClick={() => onOpenChange(false)}
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
  );
}
