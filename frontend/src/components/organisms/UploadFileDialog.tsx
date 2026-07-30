import type { DragEvent, FormEvent } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { DummyModal } from '@/components/molecules/DummyModal';
import { UploadFileList } from '@/components/molecules/UploadFileList';
import type { ConnectedAccount } from '@/lib/provider';
import type { FolderItem } from '@/data/drive-data';

export function UploadFileDialog({
  open,
  files,
  folders,
  connectedAccounts,
  activeFolder,
  targetAccountId,
  targetFolderId,
  dragging,
  submitting,
  onClose,
  onSubmit,
  onSelectFiles,
  onRemoveFile,
  onDrag,
  onTargetAccountChange,
  onTargetFolderChange,
}: {
  open: boolean;
  files: File[];
  folders: FolderItem[];
  connectedAccounts: ConnectedAccount[];
  activeFolder?: FolderItem;
  targetAccountId: string;
  targetFolderId: string;
  dragging: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  onSelectFiles: (files: FileList | File[] | null | undefined) => void;
  onRemoveFile: (index: number) => void;
  onDrag: (event: DragEvent<HTMLLabelElement>) => void;
  onTargetAccountChange: (accountId: string) => void;
  onTargetFolderChange: (folderId: string) => void;
}) {
  return (
    <DummyModal
      open={open}
      title="Upload File"
      description="Stream file directly to selected Google Drive account."
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="grid gap-4">
        <label
          onDragEnter={onDrag}
          onDragOver={onDrag}
          onDragLeave={onDrag}
          onDrop={onDrag}
          className={
            dragging
              ? 'grid cursor-pointer gap-3 rounded-sm border-2 border-dashed border-ring bg-primary/10 p-4 text-center transition sm:p-6'
              : 'grid cursor-pointer gap-3 rounded-sm border-2 border-dashed border-border bg-muted p-4 text-center transition hover:border-primary sm:p-6'
          }
        >
          <Upload
            className={
              dragging ? 'mx-auto h-8 w-8 text-primary' : 'mx-auto h-8 w-8 text-muted-foreground'
            }
          />
          <span className="text-sm font-extrabold text-foreground">
            Drop file here or click to browse
          </span>
          <span className="text-xs text-muted-foreground">
            Metadata is sent before the file so upload can stream directly to Google Drive.
          </span>
          <Input
            type="file"
            className="sr-only"
            multiple
            onChange={(event) => onSelectFiles(event.target.files)}
            required={files.length === 0}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Target Storage Account
          <Combobox
            className="h-7"
            value={targetAccountId}
            onValueChange={onTargetAccountChange}
            options={[
              { value: '', label: 'Automatic (Default)' },
              ...connectedAccounts.map((account) => ({
                value: account.id,
                label: `${account.email || account.displayName || account.id} (${account.provider === 's3' ? 'S3' : 'Google Drive'})`,
              })),
            ]}
          />
        </label>
        {activeFolder ? (
          <p className="rounded-sm bg-muted p-3 text-sm text-muted-foreground">
            Uploading to: <b>{activeFolder.name}</b>
          </p>
        ) : (
          <label className="grid gap-2 text-sm font-semibold">
            Virtual Folder
            <Combobox
              className="h-7"
              value={targetFolderId}
              onValueChange={onTargetFolderChange}
              options={[
                { value: '', label: 'No folder' },
                ...folders.map((folder) => ({ value: String(folder.id), label: folder.name })),
              ]}
            />
          </label>
        )}
        <UploadFileList files={files} onRemove={onRemoveFile} />
        <div className="grid gap-3 sm:flex sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || files.length === 0}>
            {submitting
              ? 'Uploading...'
              : `Upload${files.length > 1 ? ` ${files.length} files` : ''}`}
          </Button>
        </div>
      </form>
    </DummyModal>
  );
}
