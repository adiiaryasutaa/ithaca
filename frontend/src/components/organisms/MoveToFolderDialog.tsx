import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { DummyModal } from '@/components/molecules/DummyModal';
import type { FolderItem } from '@/data/drive-data';

export function MoveToFolderDialog({
  open,
  description,
  folders,
  selectedFolderId,
  onSelectFolder,
  onSubmit,
  onClose,
}: {
  open: boolean;
  description: string;
  folders: FolderItem[];
  selectedFolderId: string;
  onSelectFolder: (folderId: string) => void;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
}) {
  return (
    <DummyModal open={open} title="Move to Folder" description={description} onClose={onClose}>
      <form onSubmit={onSubmit} className="grid gap-4">
        <Combobox
          className="h-7"
          value={selectedFolderId}
          onValueChange={onSelectFolder}
          options={[
            { value: '', label: 'No folder' },
            ...folders.map((folder) => ({ value: String(folder.id), label: folder.name })),
          ]}
        />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Move</Button>
        </div>
      </form>
    </DummyModal>
  );
}
