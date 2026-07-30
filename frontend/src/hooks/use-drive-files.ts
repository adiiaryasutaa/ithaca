import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  folderPath,
  mapFile,
  mapFolder,
  type BackendFile,
  type BackendFolder,
} from '@/lib/drive-mappers';
import type { ConnectedAccount } from '@/lib/provider';
import type { FileItem, FolderItem } from '@/data/drive-data';

/**
 * Owns the file/folder listing for the browser page: fetching, the derived folder path, and
 * the refresh triggered when a background upload finishes.
 *
 * `searchParams` is read at call time rather than tracked as a dependency — the advanced
 * search filters (kind/accountId/size/date) are applied on the next load triggered by
 * folderId or q changing, which is how this behaved before it was a hook.
 */
export function useDriveFiles(searchParams: URLSearchParams) {
  const activeFolderId = searchParams.get('folderId');
  const searchQuery = searchParams.get('q')?.trim() ?? '';
  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [allFolders, setAllFolders] = useState<FolderItem[]>([]);
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);

  async function loadFiles() {
    const params = new URLSearchParams();
    if (activeFolderId) params.set('folderId', activeFolderId);
    else params.set('unfiled', '1');
    if (searchQuery) params.set('q', searchQuery);

    for (const key of ['kind', 'accountId', 'minSize', 'maxSize', 'startDate', 'endDate']) {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    }

    const query = params.toString();
    const data = await apiFetch<{ files: BackendFile[] }>(query ? `/files?${query}` : '/files');
    setFiles(data.files.map(mapFile));
  }

  async function loadFolders() {
    const visiblePath = activeFolderId ? `/folders?parentId=${activeFolderId}` : '/folders';
    const [visibleData, allData] = await Promise.all([
      apiFetch<{ folders: BackendFolder[] }>(visiblePath),
      apiFetch<{ folders: BackendFolder[] }>('/folders?all=1'),
    ]);
    setFolders(visibleData.folders.map(mapFolder));
    setAllFolders(allData.folders.map(mapFolder));
  }

  async function loadAll() {
    await Promise.all([loadFiles(), loadFolders()]);
  }

  useEffect(() => {
    apiFetch<{ accounts: ConnectedAccount[] }>('/connected-accounts')
      .then((data) => setConnectedAccounts(data.accounts || []))
      .catch((error) => console.error('Failed to load connected accounts:', error));
  }, []);

  useEffect(() => {
    function handleUploadCompleted() {
      loadAll().catch(() => undefined);
    }
    window.addEventListener('ithaca:upload-completed', handleUploadCompleted);
    return () => window.removeEventListener('ithaca:upload-completed', handleUploadCompleted);
  }, [activeFolderId]);

  return {
    activeFolderId,
    searchQuery,
    files,
    folders,
    allFolders,
    connectedAccounts,
    activeFolder: allFolders.find((folder) => folder.id === activeFolderId),
    folderBreadcrumbs: folderPath(allFolders, activeFolderId),
    loadFiles,
    loadFolders,
    loadAll,
  };
}
