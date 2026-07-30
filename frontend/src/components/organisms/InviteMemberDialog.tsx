import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { DummyModal } from '@/components/molecules/DummyModal';

export function InviteMemberDialog({
  open,
  targetName,
  email,
  role,
  message,
  submitting,
  onEmailChange,
  onRoleChange,
  onSubmit,
  onClose,
}: {
  open: boolean;
  targetName: string;
  email: string;
  role: string;
  message: string;
  submitting: boolean;
  onEmailChange: (email: string) => void;
  onRoleChange: (role: string) => void;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
}) {
  return (
    <DummyModal
      open={open}
      title="Invite Member"
      description={`Share ${targetName} with a team member.`}
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="grid gap-4">
        <label className="grid gap-2 text-sm font-semibold">
          Email Address
          <Input
            type="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder="member@example.com"
            required
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Role
          <Combobox
            className="h-7"
            searchable={false}
            value={role}
            onValueChange={onRoleChange}
            options={[
              { value: 'viewer', label: 'Can view' },
              { value: 'editor', label: 'Can edit' },
            ]}
          />
        </label>
        {message ? (
          <p className="rounded-sm bg-primary/10 p-3 text-sm font-semibold text-primary">
            {message}
          </p>
        ) : null}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Sending...' : 'Send Invite'}
          </Button>
        </div>
      </form>
    </DummyModal>
  );
}
