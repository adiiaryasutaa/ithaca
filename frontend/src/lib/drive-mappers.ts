import { formatBytes, formatDate } from '@/lib/api';
import { providerLabel } from '@/lib/provider';
import type { FileItem, FolderItem } from '@/data/drive-data';

export type BackendFile = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: string;
  createdAt: string;
  folderId?: string | null;
  connectedAccount?: { email: string; provider: string };
  folder?: { id: string; name: string } | null;
};

export type BackendFolder = {
  id: string;
  name: string;
  color: string;
  iconUrl?: string | null;
  parentId?: string | null;
  providerFolderId?: string | null;
  updatedAt: string;
};

export function mimeToKind(mimeType: string): FileItem['kind'] {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.includes('pdf')) return 'pdf';
  return 'doc';
}

export function mapFile(file: BackendFile): FileItem {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    createdAt: file.createdAt,
    accountEmail: file.connectedAccount?.email,
    accountProvider: providerLabel(file.connectedAccount?.provider ?? ''),
    date: formatDate(file.createdAt),
    size: formatBytes(file.sizeBytes),
    access: file.connectedAccount?.email ?? providerLabel(file.connectedAccount?.provider ?? ''),
    kind: mimeToKind(file.mimeType),
    shared: 1,
    folderId: file.folderId,
    folderName: file.folder?.name,
  };
}

export function mapFolder(folder: BackendFolder): FolderItem {
  return {
    id: folder.id,
    name: folder.name,
    color: folder.color,
    iconUrl: folder.iconUrl,
    parentId: folder.parentId,
    providerFolderId: folder.providerFolderId,
    updated: `Updated ${formatDate(folder.updatedAt)}`,
  };
}

// Walks parentId links from the active folder back to the root. `visited` guards against a
// cycle in the folder graph, which would otherwise hang the render.
export function folderPath(folders: FolderItem[], activeFolderId?: string | null) {
  const activeFolder = folders.find((folder) => folder.id === activeFolderId);
  if (!activeFolder) return [];
  const foldersById = new Map(folders.map((folder) => [folder.id, folder]));
  const path: FolderItem[] = [];
  const visited = new Set<string>();
  let current: FolderItem | undefined = activeFolder;
  while (current?.id && !visited.has(current.id)) {
    path.unshift(current);
    visited.add(current.id);
    current = current.parentId ? foldersById.get(current.parentId) : undefined;
  }
  return path;
}
