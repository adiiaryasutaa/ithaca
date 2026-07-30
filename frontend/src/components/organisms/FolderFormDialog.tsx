import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DummyModal } from '@/components/molecules/DummyModal';
import { FolderAppearanceFields } from '@/components/molecules/FolderAppearanceFields';

/**
 * Backs both "New Folder" and "Rename Folder" — same three fields, different copy. The name
 * input is only labelled on create, matching the original two dialogs.
 */
export function FolderFormDialog({
  open,
  mode,
  description,
  name,
  color,
  iconUrl,
  onNameChange,
  onColorChange,
  onIconChange,
  onSubmit,
  onClose,
}: {
  open: boolean;
  mode: 'create' | 'rename';
  description?: string;
  name: string;
  color: string;
  iconUrl: string;
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  onIconChange: (iconUrl: string) => void;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
}) {
  const isCreate = mode === 'create';
  return (
    <DummyModal
      open={open}
      title={isCreate ? 'New Folder' : 'Rename Folder'}
      description={isCreate ? 'Create a virtual folder for organizing files.' : (description ?? '')}
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="grid gap-4">
        {isCreate ? (
          <label className="grid gap-2 text-sm font-semibold">
            Folder Name
            <Input
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="Project Assets"
              required
            />
          </label>
        ) : (
          <Input value={name} onChange={(event) => onNameChange(event.target.value)} required />
        )}
        <FolderAppearanceFields
          color={color}
          iconUrl={iconUrl}
          onColorChange={onColorChange}
          onIconChange={onIconChange}
        />
        <div
          className={isCreate ? 'grid gap-3 pt-2 sm:flex sm:justify-end' : 'flex justify-end gap-3'}
        >
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">{isCreate ? 'Create Folder' : 'Rename'}</Button>
        </div>
      </form>
    </DummyModal>
  );
}
