import { useEffect, useState, type DragEvent, type FormEvent, type MouseEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ClipboardPaste } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/molecules/EmptyState';
import { FolderBreadcrumbs } from '@/components/molecules/FolderBreadcrumbs';
import { PageHeader } from '@/components/molecules/PageHeader';
import { DeleteConfirmDialog } from '@/components/organisms/DeleteConfirmDialog';
import { EmptyAreaContextMenu } from '@/components/organisms/EmptyAreaContextMenu';
import { FileContextMenu } from '@/components/organisms/FileContextMenu';
import { FileDetailsDrawer } from '@/components/organisms/FileDetailsDrawer';
import { FilePreviewDialog } from '@/components/organisms/FilePreviewDialog';
import { FileTable } from '@/components/organisms/FileTable';
import { FileToolbar } from '@/components/organisms/FileToolbar';
import { FolderContextMenu } from '@/components/organisms/FolderContextMenu';
import { FolderFormDialog } from '@/components/organisms/FolderFormDialog';
import { InviteMemberDialog } from '@/components/organisms/InviteMemberDialog';
import { MoveToFolderDialog } from '@/components/organisms/MoveToFolderDialog';
import { RenameFileDialog } from '@/components/organisms/RenameFileDialog';
import { ShareLinkDialog } from '@/components/organisms/ShareLinkDialog';
import { UploadFileDialog } from '@/components/organisms/UploadFileDialog';
import { useDriveFiles } from '@/hooks/use-drive-files';
import { useFilePreview } from '@/hooks/use-file-preview';
import { useFileSelection } from '@/hooks/use-file-selection';
import { useFolderClipboard } from '@/hooks/use-folder-clipboard';
import { useInvite } from '@/hooks/use-invite';
import { useShareLink } from '@/hooks/use-share-link';
import { apiFetch } from '@/lib/api';
import { downloadFileById, downloadFilesAsZip } from '@/lib/download';
import {
  defaultFolderColor,
  defaultFolderIconUrl,
  normalizeFolderColor,
} from '@/lib/folder-visual';
import { useUpload } from '@/context/UploadContext';
import type { FileItem, FolderItem } from '@/data/drive-data';

export function AllFilesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    activeFolderId,
    searchQuery,
    files,
    folders,
    allFolders,
    connectedAccounts,
    activeFolder,
    folderBreadcrumbs,
    loadFiles,
    loadFolders,
    loadAll,
  } = useDriveFiles(searchParams);
  const selection = useFileSelection(files);
  const preview = useFilePreview();
  const share = useShareLink();
  const invite = useInvite();
  const clipboard = useFolderClipboard(loadFolders);
  const { uploadFiles } = useUpload();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [folderRenameOpen, setFolderRenameOpen] = useState(false);
  const [folderDeleteOpen, setFolderDeleteOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState('');
  const [isUploadDragging, setIsUploadDragging] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderColor, setFolderColor] = useState(defaultFolderColor);
  const [folderIconUrl, setFolderIconUrl] = useState(defaultFolderIconUrl);
  const [renameValue, setRenameValue] = useState('');
  const [folderRenameValue, setFolderRenameValue] = useState('');
  const [folderRenameColor, setFolderRenameColor] = useState(defaultFolderColor);
  const [folderRenameIconUrl, setFolderRenameIconUrl] = useState(defaultFolderIconUrl);
  const [activeFile, setActiveFile] = useState<FileItem | null>(null);
  const [activeFolderForMenu, setActiveFolderForMenu] = useState<FolderItem | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: FileItem | null }>({
    x: 0,
    y: 0,
    file: null,
  });
  const [folderContextMenu, setFolderContextMenu] = useState<{
    x: number;
    y: number;
    folder: FolderItem | null;
  }>({ x: 0, y: 0, folder: null });
  const [emptyContextMenu, setEmptyContextMenu] = useState<{ x: number; y: number; open: boolean }>(
    { x: 0, y: 0, open: false },
  );
  const [loading, setLoading] = useState(false);
  const [syncingDrive, setSyncingDrive] = useState(false);
  const [selectedTargetAccountId, setSelectedTargetAccountId] = useState('');

  function closeFileMenu() {
    setContextMenu({ x: 0, y: 0, file: null });
  }

  function closeFolderMenu() {
    setFolderContextMenu({ x: 0, y: 0, folder: null });
  }

  function closeEmptyMenu() {
    setEmptyContextMenu({ x: 0, y: 0, open: false });
  }

  useEffect(() => {
    loadAll().catch((error) =>
      toast.error(error instanceof Error ? error.message : 'Failed to load files'),
    );
    selection.setSelectedFileIds(new Set());
  }, [activeFolderId, searchQuery]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeFileMenu();
        closeFolderMenu();
        closeEmptyMenu();
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'x' && activeFolderForMenu) {
        event.preventDefault();
        clipboard.cut(activeFolderForMenu);
        closeFolderMenu();
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'v' && clipboard.cutFolder) {
        event.preventDefault();
        pasteFolder();
      }
    }

    function onOpenMoveShortcut(e: Event) {
      const file = (e as CustomEvent).detail as FileItem;
      setActiveFile(file);
      setSelectedFolderId(file.folderId || '');
      setMoveOpen(true);
    }

    window.addEventListener('keydown', onKey);
    window.addEventListener('ithaca:open-move-modal', onOpenMoveShortcut);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('ithaca:open-move-modal', onOpenMoveShortcut);
    };
  }, [activeFolderForMenu, clipboard.cutFolder, activeFolderId]);

  function pasteFolder() {
    clipboard
      .paste(activeFolderId ?? null)
      .catch((error) =>
        toast.error(error instanceof Error ? error.message : 'Failed to paste folder'),
      );
  }

  async function handleDropItem(fileId: string, targetFolderId: string) {
    const fileIds = selection.selectedFileIds.has(fileId)
      ? Array.from(selection.selectedFileIds)
      : [fileId];
    setLoading(true);
    try {
      await apiFetch('/files/batch', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds, folderId: targetFolderId }),
      });
      toast.success(`Successfully moved ${fileIds.length} item(s).`);
      loadAll().catch(() => undefined);
      selection.setSelectedFileIds(new Set());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to move items');
    } finally {
      setLoading(false);
    }
  }

  async function createFolder(event: FormEvent) {
    event.preventDefault();
    try {
      await apiFetch('/folders', {
        method: 'POST',
        body: JSON.stringify({
          name: folderName,
          color: folderColor,
          iconUrl: folderIconUrl,
          parentId: activeFolderId ?? null,
        }),
      });
      setFolderName('');
      setFolderColor(defaultFolderColor);
      setFolderIconUrl(defaultFolderIconUrl);
      setFolderOpen(false);
      await loadFolders();
      toast.success('Folder created.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create folder');
    }
  }

  async function uploadFile(event: FormEvent) {
    event.preventDefault();
    if (selectedFiles.length === 0) return;
    setLoading(true);
    const uploadingFiles = [...selectedFiles];
    const targetFolderId = activeFolderId || selectedFolderId;
    const targetAccountId = selectedTargetAccountId || null;

    setSelectedFiles([]);
    setSelectedFolderId('');
    setSelectedTargetAccountId('');
    setUploadOpen(false);

    try {
      await uploadFiles(uploadingFiles, targetFolderId, targetAccountId);
    } catch (err) {
      console.error('Upload initiation failed:', err);
    } finally {
      setLoading(false);
    }
  }

  async function syncGoogleDrive() {
    setSyncingDrive(true);
    try {
      const response = await apiFetch<{
        results: { created: number; updated: number; deleted: number }[];
      }>('/files/sync-google', { method: 'POST', body: JSON.stringify({}) });

      let created = 0,
        updated = 0,
        deleted = 0;
      for (const res of response.results) {
        created += res.created;
        updated += res.updated;
        deleted += res.deleted;
      }
      const accounts = response.results.length;

      toast.success(
        `Google Drive synced. ${created} added, ${updated} updated, ${deleted} removed across ${accounts} account${accounts === 1 ? '' : 's'}.`,
      );
      await loadAll();
      window.dispatchEvent(new Event('ithaca:storage-changed'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to sync Google Drive');
    } finally {
      setSyncingDrive(false);
    }
  }

  function selectUploadFiles(files: FileList | File[] | null | undefined) {
    if (!files) return;
    const nextFiles = Array.from(files);
    if (nextFiles.length === 0) return;
    setSelectedFiles(nextFiles);
  }

  function removeUploadFile(index: number) {
    setSelectedFiles((files) => files.filter((_, fileIndex) => fileIndex !== index));
  }

  function handleUploadDrag(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (event.type === 'dragenter' || event.type === 'dragover') setIsUploadDragging(true);
    if (event.type === 'dragleave' || event.type === 'drop') setIsUploadDragging(false);
    if (event.type === 'drop') selectUploadFiles(event.dataTransfer.files);
  }

  function openContext(event: MouseEvent<HTMLElement>, file: FileItem) {
    event.preventDefault();
    event.stopPropagation();
    setActiveFile(file);
    setContextMenu({ x: event.clientX, y: event.clientY, file });
  }

  function openFolderMenu(event: MouseEvent<HTMLElement>, folder: FolderItem) {
    event.preventDefault();
    event.stopPropagation();
    setActiveFolderForMenu(folder);
    setFolderContextMenu({ x: event.clientX, y: event.clientY, folder });
  }

  function openFolder(folder: FolderItem) {
    if (!folder.id) return;
    setSearchParams(
      searchQuery ? { folderId: folder.id, q: searchQuery } : { folderId: folder.id },
    );
  }

  function openFolderById(folderId: string) {
    setSearchParams(searchQuery ? { folderId, q: searchQuery } : { folderId });
  }

  function openEmptyContextMenu(event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    setEmptyContextMenu({ x: event.clientX, y: event.clientY, open: true });
  }

  function closeFolder() {
    setSearchParams(searchQuery ? { q: searchQuery } : {});
  }

  async function downloadFile() {
    if (!activeFile?.id) return;
    await downloadFileById(activeFile.id, activeFile.name);
    closeFileMenu();
  }

  async function downloadBatchAsZip() {
    const selectedIds = [...selection.selectedFileIds];
    if (selectedIds.length === 0) return;
    setLoading(true);
    try {
      await downloadFilesAsZip(selectedIds);
      selection.clear();
      toast.success('Batch download complete.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Batch download failed');
    } finally {
      setLoading(false);
    }
  }

  async function renameFile(event: FormEvent) {
    event.preventDefault();
    if (!activeFile?.id) return;
    await apiFetch(`/files/${activeFile.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: renameValue }),
    });
    setRenameOpen(false);
    await loadFiles();
  }

  async function moveFile(event: FormEvent) {
    event.preventDefault();
    const selectedIds = [...selection.selectedFileIds];
    if (selectedIds.length > 0)
      await apiFetch('/files/batch', {
        method: 'PATCH',
        body: JSON.stringify({ fileIds: selectedIds, folderId: selectedFolderId || null }),
      });
    else if (activeFile?.id)
      await apiFetch(`/files/${activeFile.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ folderId: selectedFolderId || null }),
      });
    else return;
    setMoveOpen(false);
    setSelectedFolderId('');
    selection.clear();
    await loadFiles();
  }

  async function deleteFile() {
    const selectedIds = [...selection.selectedFileIds];
    if (selectedIds.length > 0)
      await apiFetch('/files/batch', {
        method: 'DELETE',
        body: JSON.stringify({ fileIds: selectedIds }),
      });
    else if (activeFile?.id) await apiFetch(`/files/${activeFile.id}`, { method: 'DELETE' });
    else return;
    setDeleteOpen(false);
    selection.clear();
    await loadFiles();
    window.dispatchEvent(new Event('ithaca:storage-changed'));
  }

  async function copyFolderLink() {
    if (!activeFolderForMenu?.id) return;
    let url = `${window.location.origin}/all-files?folderId=${activeFolderForMenu.id}`;
    if (activeFolderForMenu.providerFolderId) {
      url = `https://drive.google.com/open?id=${activeFolderForMenu.providerFolderId}`;
    }
    await navigator.clipboard.writeText(url);
    toast.success('Folder link copied to clipboard!');
    closeFolderMenu();
  }

  async function renameFolder(event: FormEvent) {
    event.preventDefault();
    if (!activeFolderForMenu?.id) return;
    await apiFetch(`/folders/${activeFolderForMenu.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: folderRenameValue,
        color: folderRenameColor,
        iconUrl: folderRenameIconUrl,
      }),
    });
    setFolderRenameOpen(false);
    await loadFolders();
  }

  async function deleteFolder() {
    if (!activeFolderForMenu?.id) return;
    await apiFetch(`/folders/${activeFolderForMenu.id}`, { method: 'DELETE' });
    setFolderDeleteOpen(false);
    await loadFolders();
  }

  const emptyMessage = searchQuery
    ? `No files found for "${searchQuery}".`
    : activeFolder
      ? 'No files or folders in this folder yet.'
      : 'No uploaded files yet. Connect Google Drive in Settings, then upload a file.';

  return (
    <>
      <div onContextMenu={openEmptyContextMenu} className="min-h-[620px] w-full min-w-0">
        <PageHeader
          title={
            <FolderBreadcrumbs
              path={folderBreadcrumbs}
              onRootClick={closeFolder}
              onFolderClick={openFolderById}
            />
          }
        />
        <FileToolbar
          selectedCount={selection.selectedFileIds.size}
          selectMode={selection.selectMode}
          syncing={syncingDrive}
          onToggleSelectMode={selection.toggleSelectMode}
          onClearSelection={selection.clear}
          onDownloadZip={downloadBatchAsZip}
          onMoveSelected={() => setMoveOpen(true)}
          onDeleteSelected={() => setDeleteOpen(true)}
          onUpload={() => setUploadOpen(true)}
          onNewFolder={() => setFolderOpen(true)}
          onSync={syncGoogleDrive}
        />
        {clipboard.cutFolder ? (
          <p className="mt-3 rounded-sm bg-amber-50 p-3 text-sm font-semibold text-amber-700">
            <ClipboardPaste className="mr-2 inline h-4 w-4" />
            Cut folder: {clipboard.cutFolder.name}. Press Ctrl+V or right-click empty area to paste
            here.
          </p>
        ) : null}
        {files.length === 0 && folders.length === 0 ? (
          <EmptyState className="mt-3" message={emptyMessage} />
        ) : (
          <Card className="mt-3 min-w-0 overflow-x-auto p-0 bg-card dark:bg-transparent dark:shadow-none">
            <FileTable
              files={files}
              folders={folders}
              selectable={selection.selectMode}
              selectedFileIds={selection.selectedFileIds}
              allSelected={selection.allVisibleSelected}
              onToggleFile={selection.toggleFile}
              onToggleAll={selection.toggleAllVisible}
              onFileContextMenu={openContext}
              onFolderOpen={openFolder}
              onFolderMenu={openFolderMenu}
              onDropOnFolder={handleDropItem}
            />
          </Card>
        )}
      </div>
      <EmptyAreaContextMenu
        x={emptyContextMenu.x}
        y={emptyContextMenu.y}
        open={emptyContextMenu.open}
        canPasteFolder={Boolean(clipboard.cutFolder)}
        onClose={closeEmptyMenu}
        onUpload={() => {
          setUploadOpen(true);
          closeEmptyMenu();
        }}
        onCreateFolder={() => {
          setFolderOpen(true);
          closeEmptyMenu();
        }}
        onPasteFolder={() => {
          pasteFolder();
          closeEmptyMenu();
        }}
      />
      <FileContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        file={contextMenu.file}
        onClose={closeFileMenu}
        onView={() => {
          preview.preview(activeFile);
          closeFileMenu();
        }}
        onDownload={downloadFile}
        onRename={() => {
          setRenameValue(activeFile?.name ?? '');
          setRenameOpen(true);
          closeFileMenu();
        }}
        onMove={() => {
          setMoveOpen(true);
          closeFileMenu();
        }}
        onDetails={() => {
          setDetailOpen(true);
          closeFileMenu();
        }}
        onShare={() => {
          share.share(activeFile);
          closeFileMenu();
        }}
        onCopyLink={() => {
          share.copyDirectLink(activeFile);
          closeFileMenu();
        }}
        onInvite={() => {
          invite.invite('file', activeFile?.id);
          closeFileMenu();
        }}
        onDelete={() => {
          setDeleteOpen(true);
          closeFileMenu();
        }}
      />
      <FolderContextMenu
        x={folderContextMenu.x}
        y={folderContextMenu.y}
        folder={folderContextMenu.folder}
        onClose={closeFolderMenu}
        onCut={() => {
          clipboard.cut(activeFolderForMenu);
          closeFolderMenu();
        }}
        onRename={() => {
          setFolderRenameValue(activeFolderForMenu?.name ?? '');
          setFolderRenameColor(normalizeFolderColor(activeFolderForMenu?.color));
          setFolderRenameIconUrl(activeFolderForMenu?.iconUrl ?? defaultFolderIconUrl);
          setFolderRenameOpen(true);
          closeFolderMenu();
        }}
        onInvite={() => {
          invite.invite('folder', activeFolderForMenu?.id);
          closeFolderMenu();
        }}
        onCopyLink={copyFolderLink}
        onDelete={() => {
          setFolderDeleteOpen(true);
          closeFolderMenu();
        }}
      />
      <FileDetailsDrawer open={detailOpen} file={activeFile} onClose={() => setDetailOpen(false)} />

      <UploadFileDialog
        open={uploadOpen}
        files={selectedFiles}
        folders={allFolders}
        connectedAccounts={connectedAccounts}
        activeFolder={activeFolder}
        targetAccountId={selectedTargetAccountId}
        targetFolderId={selectedFolderId}
        dragging={isUploadDragging}
        submitting={loading}
        onClose={() => setUploadOpen(false)}
        onSubmit={uploadFile}
        onSelectFiles={selectUploadFiles}
        onRemoveFile={removeUploadFile}
        onDrag={handleUploadDrag}
        onTargetAccountChange={setSelectedTargetAccountId}
        onTargetFolderChange={setSelectedFolderId}
      />
      <FolderFormDialog
        open={folderOpen}
        mode="create"
        name={folderName}
        color={folderColor}
        iconUrl={folderIconUrl}
        onNameChange={setFolderName}
        onColorChange={setFolderColor}
        onIconChange={setFolderIconUrl}
        onSubmit={createFolder}
        onClose={() => setFolderOpen(false)}
      />
      <FolderFormDialog
        open={folderRenameOpen}
        mode="rename"
        description={activeFolderForMenu?.name ?? ''}
        name={folderRenameValue}
        color={folderRenameColor}
        iconUrl={folderRenameIconUrl}
        onNameChange={setFolderRenameValue}
        onColorChange={setFolderRenameColor}
        onIconChange={setFolderRenameIconUrl}
        onSubmit={renameFolder}
        onClose={() => setFolderRenameOpen(false)}
      />
      <RenameFileDialog
        open={renameOpen}
        fileName={activeFile?.name ?? ''}
        value={renameValue}
        onChange={setRenameValue}
        onSubmit={renameFile}
        onClose={() => setRenameOpen(false)}
      />
      <MoveToFolderDialog
        open={moveOpen}
        description={
          selection.selectedFileIds.size > 0
            ? `Move ${selection.selectedFileIds.size} files`
            : (activeFile?.name ?? '')
        }
        folders={allFolders}
        selectedFolderId={selectedFolderId}
        onSelectFolder={setSelectedFolderId}
        onSubmit={moveFile}
        onClose={() => setMoveOpen(false)}
      />
      <DeleteConfirmDialog
        open={deleteOpen}
        title={selection.selectedFileIds.size > 0 ? 'Delete Files' : 'Delete File'}
        description={
          selection.selectedFileIds.size > 0
            ? `Delete ${selection.selectedFileIds.size} files from Google Drive?`
            : `Delete ${activeFile?.name ?? 'file'} from Google Drive?`
        }
        onConfirm={deleteFile}
        onClose={() => setDeleteOpen(false)}
      />
      <DeleteConfirmDialog
        open={folderDeleteOpen}
        title="Delete Folder"
        description={`Delete virtual folder ${activeFolderForMenu?.name ?? ''}? Files inside will remain uploaded.`}
        onConfirm={deleteFolder}
        onClose={() => setFolderDeleteOpen(false)}
      />
      <ShareLinkDialog
        open={share.open}
        file={activeFile}
        shareUrl={share.shareUrl}
        copied={share.copied}
        gdrivePublicUrl={share.gdrivePublicUrl}
        makingPublic={share.makingPublic}
        onCopy={share.copy}
        onMakePublic={() => share.makePublic(activeFile)}
        onClose={() => share.setOpen(false)}
      />
      <InviteMemberDialog
        open={invite.open}
        targetName={
          invite.target.type === 'file'
            ? (activeFile?.name ?? 'file')
            : (activeFolderForMenu?.name ?? 'folder')
        }
        email={invite.email}
        role={invite.role}
        message={invite.message}
        submitting={invite.submitting}
        onEmailChange={invite.setEmail}
        onRoleChange={invite.setRole}
        onSubmit={invite.submit}
        onClose={() => invite.setOpen(false)}
      />
      <FilePreviewDialog
        open={preview.open}
        file={activeFile}
        url={preview.url}
        loading={preview.loading}
        error={preview.error}
        onError={preview.setError}
        onClose={preview.close}
      />
    </>
  );
}
