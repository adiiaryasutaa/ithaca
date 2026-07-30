import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DummyModal } from '@/components/molecules/DummyModal';

export function RenameFileDialog({
  open,
  fileName,
  value,
  onChange,
  onSubmit,
  onClose,
}: {
  open: boolean;
  fileName: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
}) {
  return (
    <DummyModal open={open} title="Rename File" description={fileName} onClose={onClose}>
      <form onSubmit={onSubmit} className="grid gap-4">
        <Input value={value} onChange={(event) => onChange(event.target.value)} required />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Rename</Button>
        </div>
      </form>
    </DummyModal>
  );
}
