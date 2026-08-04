import { logger } from '../../config/logger.js';
import { createAuditLog } from '../../utils/audit.js';
import { HttpError } from '../../utils/http-error.js';
import {
  createGoogleDriveFolder,
  deleteGoogleDriveItem,
  ensureGoogleAppFolder,
  moveGoogleFolder,
  renameGoogleFolder,
  syncGoogleQuota,
} from '../google/google.service.js';
import * as folderRepository from './folder.repository.js';

const defaultFolderColor = '#3b82f6';
const defaultFolderIconUrl = 'https://api.iconify.design/lucide:folder.svg';

type FolderRecord = {
  id: string;
  name: string;
  color: string;
  iconUrl?: string | null;
  parentId?: string | null;
  providerFolderId?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function serializeFolder(folder: FolderRecord) {
  return {
    ...folder,
    providerFolderId: folder.providerFolderId ?? null,
    createdAt: folder.createdAt.toISOString(),
    updatedAt: folder.updatedAt.toISOString(),
  };
}

export function collectDescendantIds(
  rootId: string,
  folders: Array<{ id: string; parentId: string | null }>,
) {
  const descendantIds = new Set<string>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const folder of folders) {
      if (folder.parentId && descendantIds.has(folder.parentId) && !descendantIds.has(folder.id)) {
        descendantIds.add(folder.id);
        changed = true;
      }
    }
  }
  return descendantIds;
}

async function ensureProviderFolderIds(
  folders: Array<{
    id: string;
    name: string;
    parentId: string | null;
    providerFolderId: string | null;
  }>,
) {
  const foldersWithoutId = folders.filter((f) => !f.providerFolderId);
  if (foldersWithoutId.length === 0) return;

  const connectedAccount = await folderRepository.findConnectedGoogleDriveAccount();
  if (!connectedAccount) return;

  try {
    const appFolderId = await ensureGoogleAppFolder(connectedAccount);

    for (const folder of foldersWithoutId) {
      try {
        let parentGoogleId = appFolderId;
        if (folder.parentId) {
          const parentFolder = await folderRepository.findFolderById(folder.parentId);
          if (parentFolder?.providerFolderId) {
            parentGoogleId = parentFolder.providerFolderId;
          }
        }

        const gId = await createGoogleDriveFolder(connectedAccount, folder.name, parentGoogleId);
        if (gId) {
          await folderRepository.updateFolderProviderId(folder.id, {
            providerFolderId: gId,
            connectedAccountId: connectedAccount.id,
          });
          folder.providerFolderId = gId;
        }
      } catch (error) {
        logger.error({ err: error, folderId: folder.id }, 'Failed self-healing for folder');
      }
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed self-healing Google Drive auth');
  }
}

export async function listFolders(parentId: string | null | undefined, all: boolean) {
  const folders = await folderRepository.findActiveFolders(all ? {} : { parentId: parentId ?? null });
  await ensureProviderFolderIds(folders);
  return folders.map(serializeFolder);
}

export async function listRecentFolders(limit: number) {
  const folders = await folderRepository.findRecentFolders(limit);
  await ensureProviderFolderIds(folders);
  return folders.map(serializeFolder);
}

export async function createFolder(
  userId: string,
  input: { name: string; color?: string; iconUrl?: string | null; parentId?: string | null },
) {
  let parentFolder = null;
  if (input.parentId) {
    parentFolder = await folderRepository.findActiveFolderByIdOrThrow(input.parentId);
  }

  const connectedAccount = await folderRepository.findConnectedGoogleDriveAccount();

  let providerFolderId: string | null = null;
  if (connectedAccount) {
    try {
      let googleParentId = await ensureGoogleAppFolder(connectedAccount);
      if (parentFolder?.providerFolderId) {
        googleParentId = parentFolder.providerFolderId;
      }
      providerFolderId = await createGoogleDriveFolder(connectedAccount, input.name, googleParentId);
    } catch (error) {
      logger.error({ err: error }, 'Failed to create folder on Google Drive');
    }
  }

  const folder = await folderRepository.createFolder({
    userId,
    name: input.name,
    color: input.color ?? defaultFolderColor,
    iconUrl: input.iconUrl ?? defaultFolderIconUrl,
    parentId: input.parentId ?? null,
    providerFolderId,
    connectedAccountId: connectedAccount?.id ?? null,
  });
  await createAuditLog(userId, 'CREATE_FOLDER', 'folder', folder.id, { name: folder.name });
  return serializeFolder(folder);
}

export async function updateFolder(
  userId: string,
  folderId: string,
  body: { name?: string; color?: string; iconUrl?: string | null; parentId?: string | null },
) {
  if (body.parentId === folderId)
    throw new HttpError(400, 'FOLDER_INVALID_PARENT', 'Folder cannot be moved into itself.');

  const folderRecord = await folderRepository.findActiveFolderWithAccountOrThrow(folderId);

  if (body.parentId) {
    await folderRepository.findActiveFolderByIdOrThrow(body.parentId);
    const folders = await folderRepository.findAllActiveFolderParentLinks();
    const descendantIds = collectDescendantIds(folderId, folders);
    if (descendantIds.has(body.parentId))
      throw new HttpError(
        400,
        'FOLDER_INVALID_PARENT',
        'Folder cannot be moved into itself or a child folder.',
      );
  }

  if (body.name && folderRecord.providerFolderId && folderRecord.connectedAccount) {
    try {
      await renameGoogleFolder(folderRecord.connectedAccount, folderRecord.providerFolderId, body.name);
    } catch (error) {
      logger.error({ err: error }, 'Failed to rename folder on Google Drive');
    }
  }

  if (body.parentId !== undefined && folderRecord.providerFolderId && folderRecord.connectedAccount) {
    try {
      let newGoogleParentId = await ensureGoogleAppFolder(folderRecord.connectedAccount);
      if (body.parentId) {
        const newParent = await folderRepository.findFolderById(body.parentId);
        if (newParent?.providerFolderId) {
          newGoogleParentId = newParent.providerFolderId;
        }
      }
      await moveGoogleFolder(
        folderRecord.connectedAccount,
        folderRecord.providerFolderId,
        newGoogleParentId,
      );
    } catch (error) {
      logger.error({ err: error }, 'Failed to move folder on Google Drive');
    }
  }

  const updateResult = await folderRepository.updateFolderFields(folderId, {
    ...(body.name ? { name: body.name } : {}),
    ...(body.color ? { color: body.color } : {}),
    ...(body.iconUrl !== undefined ? { iconUrl: body.iconUrl } : {}),
    ...(body.parentId !== undefined ? { parentId: body.parentId } : {}),
  });
  if (updateResult.count === 0) throw new HttpError(404, 'FOLDER_NOT_FOUND', 'Folder not found.');

  const updated = await folderRepository.findFolderByIdSelect(folderId);
  await createAuditLog(userId, 'UPDATE_FOLDER', 'folder', updated.id, {
    name: updated.name,
    updates: body,
  });
  return serializeFolder(updated);
}

export async function deleteFolder(userId: string, rootId: string) {
  const root = await folderRepository.findActiveFolderByIdOrThrow(rootId);
  const folders = await folderRepository.findAllActiveFolderParentLinks();
  const folderIds = collectDescendantIds(root.id, folders);

  const files = await folderRepository.findActiveFilesInFolders([...folderIds]);
  const syncedAccountIds = new Set<string>();
  for (const file of files) {
    try {
      await deleteGoogleDriveItem(file.connectedAccount, file.providerFileId);
      syncedAccountIds.add(file.connectedAccountId);
    } catch {
      // Keep going so one failure does not block the whole deletion
    }
  }

  const foldersToDelete = await folderRepository.findFoldersByIdsWithAccount([...folderIds]);
  for (const f of foldersToDelete) {
    if (f.providerFolderId && f.connectedAccount) {
      try {
        await deleteGoogleDriveItem(f.connectedAccount, f.providerFolderId);
        if (f.connectedAccountId) syncedAccountIds.add(f.connectedAccountId);
      } catch {
        // ignore
      }
    }
  }

  await folderRepository.markFilesDeletedByIds(files.map((file) => file.id));
  await folderRepository.markFoldersDeletedByIds([...folderIds]);
  for (const accountId of syncedAccountIds) await syncGoogleQuota(accountId).catch(() => undefined);

  await createAuditLog(userId, 'DELETE_FOLDER', 'folder', root.id, { name: root.name });
}
