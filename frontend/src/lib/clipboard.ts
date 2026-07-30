import { toast } from 'sonner';

export function copyText(value: string, message = 'Copied to clipboard.') {
  navigator.clipboard
    .writeText(value)
    .then(() => toast.success(message))
    .catch(() => toast.error('Failed to copy.'));
}
