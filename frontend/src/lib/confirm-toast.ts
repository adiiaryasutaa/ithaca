import { toast } from 'sonner';

export function confirmToast(message: string, onConfirm: () => void, confirmLabel = 'Confirm') {
  toast(message, {
    action: { label: confirmLabel, onClick: onConfirm },
    cancel: { label: 'Cancel', onClick: () => {} },
  });
}
