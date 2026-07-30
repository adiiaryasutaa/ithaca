import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { DummyModal } from '@/components/molecules/DummyModal';

export type ApiKeyDraft = {
  name: string;
  mode: 'upload' | 'read';
  targetKind: 'none' | 'folder' | 'file';
  targetFolderId: string;
  targetFileId: string;
};

export const emptyApiKeyDraft: ApiKeyDraft = {
  name: '',
  mode: 'upload',
  targetKind: 'none',
  targetFolderId: '',
  targetFileId: '',
};

export function CreateApiKeyDialog({
  open,
  draft,
  folders,
  files,
  submitting,
  onChange,
  onSubmit,
  onClose,
}: {
  open: boolean;
  draft: ApiKeyDraft;
  folders: { id: string; name: string }[];
  files: { id: string; name: string }[];
  submitting: boolean;
  onChange: (draft: ApiKeyDraft) => void;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
}) {
  return (
    <DummyModal
      open={open}
      title="Create API Key"
      description="Upload keys can be pinned to a folder; read keys can be pinned to a file or folder."
      onClose={onClose}
    >
      <form className="grid gap-4" onSubmit={onSubmit}>
        <Input
          placeholder="Key name"
          value={draft.name}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
          required
        />
        <label className="grid gap-2 text-sm font-semibold">
          Mode
          <Combobox
            className="h-7"
            searchable={false}
            value={draft.mode}
            // Switching mode clears every pin: an upload key can only pin a folder, so a
            // file pin carried over from read mode would be silently dropped by the API.
            onValueChange={(value) =>
              onChange({
                ...draft,
                mode: value as ApiKeyDraft['mode'],
                targetKind: 'none',
                targetFolderId: '',
                targetFileId: '',
              })
            }
            options={[
              { value: 'upload', label: 'Upload (pin to folder)' },
              { value: 'read', label: 'Read (pin to file or folder)' },
            ]}
          />
        </label>

        {draft.mode === 'upload' ? (
          <label className="grid gap-2 text-sm font-semibold">
            Pinned Folder
            <Combobox
              className="h-7"
              value={draft.targetFolderId}
              onValueChange={(id) => onChange({ ...draft, targetFolderId: id })}
              placeholder="No folder (unrestricted)"
              options={[
                { value: '', label: 'No folder (unrestricted)' },
                ...folders.map((folder) => ({ value: folder.id, label: folder.name })),
              ]}
            />
          </label>
        ) : (
          <>
            <label className="grid gap-2 text-sm font-semibold">
              Pin To
              <Combobox
                className="h-7"
                searchable={false}
                value={draft.targetKind}
                onValueChange={(value) =>
                  onChange({
                    ...draft,
                    targetKind: value as ApiKeyDraft['targetKind'],
                    targetFolderId: '',
                    targetFileId: '',
                  })
                }
                options={[
                  { value: 'none', label: 'Nothing (unrestricted)' },
                  { value: 'folder', label: 'A folder' },
                  { value: 'file', label: 'A file' },
                ]}
              />
            </label>
            {draft.targetKind === 'folder' ? (
              <label className="grid gap-2 text-sm font-semibold">
                Folder
                <Combobox
                  className="h-7"
                  value={draft.targetFolderId}
                  onValueChange={(id) => onChange({ ...draft, targetFolderId: id })}
                  placeholder="Select a folder"
                  options={folders.map((folder) => ({ value: folder.id, label: folder.name }))}
                />
              </label>
            ) : null}
            {draft.targetKind === 'file' ? (
              <label className="grid gap-2 text-sm font-semibold">
                File
                <Combobox
                  className="h-7"
                  value={draft.targetFileId}
                  onValueChange={(id) => onChange({ ...draft, targetFileId: id })}
                  placeholder="Select a file"
                  options={files.map((file) => ({ value: file.id, label: file.name }))}
                />
              </label>
            ) : null}
          </>
        )}

        <div className="grid gap-3 sm:flex sm:justify-end">
          <Button variant="outline" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Key'}
          </Button>
        </div>
      </form>
    </DummyModal>
  );
}
