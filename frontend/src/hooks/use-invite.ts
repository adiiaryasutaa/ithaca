import { useState, type FormEvent } from 'react';
import { apiFetch } from '@/lib/api';

type InviteTarget = { type: 'file' | 'folder'; id: string };

export function useInvite() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [target, setTarget] = useState<InviteTarget>({ type: 'file', id: '' });
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function invite(type: InviteTarget['type'], id: string | undefined) {
    if (!id) return;
    setTarget({ type, id });
    setOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!target.id) return;
    setSubmitting(true);
    setMessage('');
    try {
      await apiFetch('/invites', {
        method: 'POST',
        body: JSON.stringify({ email, role, targetType: target.type, targetId: target.id }),
      });
      setEmail('');
      setRole('viewer');
      setMessage('Invite saved. Member will appear in Shared.');
      window.dispatchEvent(new Event('ithaca:invites-changed'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to send invite');
    } finally {
      setSubmitting(false);
    }
  }

  return {
    open,
    setOpen,
    email,
    setEmail,
    role,
    setRole,
    target,
    message,
    submitting,
    invite,
    submit,
  };
}
