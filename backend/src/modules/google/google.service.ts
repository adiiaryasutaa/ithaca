import { google } from 'googleapis';
import type { ConnectedAccount, ProviderConfig } from '@prisma/client';
import { decryptText, encryptText, hashToken, randomToken } from '../../utils/crypto.js';
import {
  createOAuthState,
  createSyncedGoogleFile,
  findConnectedAccountById,
  findConnectedGoogleAccountById,
  findGoogleFilesForAccount,
  findProviderConfigById,
  findWorkspaceFoldersForAccount,
  markFilesDeleted,
  updateConnectedAccountTokens,
  updateSyncedGoogleFile,
  upsertStorageAccountQuota,
} from './google.repository.js';

const googleDriveFolderMimeType = 'application/vnd.google-apps.folder';
const appFolderName = 'Ithaca';

export type GoogleAuthClient = ReturnType<typeof createOAuthClient>;
export type GoogleDriveClient = ReturnType<typeof google.drive>;

export function createOAuthClient(config: ProviderConfig) {
  return new google.auth.OAuth2(
    decryptText(config.clientIdEncrypted),
    decryptText(config.clientSecretEncrypted),
    config.redirectUri,
  );
}

export async function getAuthedGoogleClient(account: ConnectedAccount) {
  if (!account.accessTokenEncrypted || !account.refreshTokenEncrypted || !account.tokenExpiresAt)
    throw new Error('Google account tokens are missing.');
  if (!account.providerConfigId) throw new Error('Google provider config is missing.');
  const config = await findProviderConfigById(account.providerConfigId);
  const client = createOAuthClient(config);
  client.setCredentials({
    access_token: decryptText(account.accessTokenEncrypted),
    refresh_token: decryptText(account.refreshTokenEncrypted),
    expiry_date: account.tokenExpiresAt.getTime(),
  });

  if (account.tokenExpiresAt.getTime() < Date.now() + 60_000) {
    const result = await client.refreshAccessToken();
    const credentials = result.credentials;
    if (credentials.access_token) {
      await updateConnectedAccountTokens(account.id, {
        accessTokenEncrypted: encryptText(credentials.access_token),
        tokenExpiresAt: new Date(credentials.expiry_date ?? Date.now() + 3600_000),
      });
      client.setCredentials(credentials);
    }
  }

  return client;
}

export async function syncGoogleQuota(accountId: string) {
  const account = await findConnectedAccountById(accountId);
  const auth = await getAuthedGoogleClient(account);
  const drive = google.drive({ version: 'v3', auth });
  const about = await drive.about.get({ fields: 'storageQuota,user' });
  const quota = about.data.storageQuota;
  const total = quota?.limit ? BigInt(quota.limit) : null;
  const used = quota?.usage ? BigInt(quota.usage) : 0n;
  return upsertStorageAccountQuota(accountId, {
    totalBytes: total,
    usedBytes: used,
    availableBytes: total === null ? null : total - used,
    trashBytes: quota?.usageInDriveTrash ? BigInt(quota.usageInDriveTrash) : null,
  });
}

function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export async function ensureGoogleAppFolder(account: ConnectedAccount) {
  const auth = await getAuthedGoogleClient(account);
  const drive = google.drive({ version: 'v3', auth });
  const queryName = escapeDriveQueryValue(appFolderName);
  const existing = await drive.files.list({
    q: `name = '${queryName}' and mimeType = '${googleDriveFolderMimeType}' and 'root' in parents and trashed = false`,
    spaces: 'drive',
    fields: 'files(id,name)',
    pageSize: 1,
  });
  const folderId =
    existing.data.files?.[0]?.id ??
    (
      await drive.files.create({
        requestBody: {
          name: appFolderName,
          mimeType: googleDriveFolderMimeType,
          parents: ['root'],
        },
        fields: 'id',
      })
    ).data.id;

  if (!folderId) throw new Error('Failed to create Google Drive app folder.');
  return folderId;
}

export type GoogleAppFolderSyncResult = {
  accountId: string;
  created: number;
  updated: number;
  deleted: number;
};

type DriveFileMetadata = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: bigint;
  parentId: string;
};

export async function syncGoogleAppFolderFiles(
  accountId: string,
  createdByUserId: string,
): Promise<GoogleAppFolderSyncResult> {
  const account = await findConnectedGoogleAccountById(accountId);
  const auth = await getAuthedGoogleClient(account);
  const drive = google.drive({ version: 'v3', auth });
  const appFolderId = await ensureGoogleAppFolder(account);

  const workspaceFolders = await findWorkspaceFoldersForAccount(account.id);
  const parentIds = [
    appFolderId,
    ...workspaceFolders.map((f) => f.providerFolderId).filter((id): id is string => !!id),
  ];

  const driveFiles: DriveFileMetadata[] = [];
  let pageToken: string | undefined;

  const parentsQuery = parentIds.map((id) => `'${id}' in parents`).join(' or ');
  const q = `(${parentsQuery}) and mimeType != '${googleDriveFolderMimeType}' and trashed = false`;

  do {
    const response = await drive.files.list({
      q,
      spaces: 'drive',
      fields: 'nextPageToken,files(id,name,mimeType,size,parents)',
      pageSize: 1000,
      pageToken,
    });
    for (const file of response.data.files ?? []) {
      if (!file.id || !file.name || !file.mimeType) continue;
      const parentId = file.parents?.[0] ?? appFolderId;
      driveFiles.push({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        sizeBytes: BigInt(file.size ?? 0),
        parentId,
      });
    }
    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  const existingFiles = await findGoogleFilesForAccount(account.id);
  const existingByProviderId = new Map(existingFiles.map((file) => [file.providerFileId, file]));
  const driveFileIds = new Set(driveFiles.map((file) => file.id));
  let created = 0;
  let updated = 0;
  let deleted = 0;

  const folderIdMap = new Map(workspaceFolders.map((f) => [f.providerFolderId, f.id]));

  for (const driveFile of driveFiles) {
    const dbFolderId =
      driveFile.parentId === appFolderId ? null : (folderIdMap.get(driveFile.parentId) ?? null);
    const existing = existingByProviderId.get(driveFile.id);
    if (!existing) {
      await createSyncedGoogleFile({
        userId: createdByUserId,
        connectedAccountId: account.id,
        providerFileId: driveFile.id,
        name: driveFile.name,
        mimeType: driveFile.mimeType,
        sizeBytes: driveFile.sizeBytes,
        folderId: dbFolderId,
      });
      created += 1;
      continue;
    }

    const needsUpdate =
      existing.name !== driveFile.name ||
      existing.mimeType !== driveFile.mimeType ||
      existing.sizeBytes !== driveFile.sizeBytes ||
      existing.status !== 'active' ||
      existing.deletedAt !== null ||
      existing.folderId !== dbFolderId;
    if (needsUpdate) {
      await updateSyncedGoogleFile(existing.id, {
        name: driveFile.name,
        mimeType: driveFile.mimeType,
        sizeBytes: driveFile.sizeBytes,
        folderId: dbFolderId,
      });
      updated += 1;
    }
  }

  const missingActiveIds = existingFiles
    .filter((file) => file.status === 'active' && !driveFileIds.has(file.providerFileId))
    .map((file) => file.id);
  if (missingActiveIds.length > 0) {
    const result = await markFilesDeleted(missingActiveIds);
    deleted = result.count;
  }

  await syncGoogleQuota(account.id).catch(() => undefined);
  return { accountId: account.id, created, updated, deleted };
}

export async function exchangeGoogleOAuthCode(config: ProviderConfig, code: string) {
  const client = createOAuthClient(config);
  const tokenResult = await client.getToken(code);
  const tokens = tokenResult.tokens;
  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const profile = await oauth2.userinfo.get();
  return {
    tokens,
    profile: {
      providerAccountId: profile.data.id,
      email: profile.data.email,
      name: profile.data.name,
      picture: profile.data.picture,
      verifiedEmail: profile.data.verified_email,
    },
  };
}

export async function createGoogleAuthUrl(params: {
  config: ProviderConfig;
  flow: string;
  userId?: string;
}) {
  const state = randomToken();
  await createOAuthState({
    providerConfigId: params.config.id,
    flow: params.flow,
    stateHash: hashToken(state),
    expiresAt: new Date(Date.now() + 10 * 60_000),
    userId: params.userId,
  });
  const client = createOAuthClient(params.config);
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    scope: params.config.scopes as string[],
    state,
  });
}

export async function makeGoogleFilePublic(drive: GoogleDriveClient, fileId: string) {
  await drive.permissions.create({
    fileId,
    requestBody: { role: 'writer', type: 'anyone' },
  });
}

export async function renameGoogleFolder(
  account: ConnectedAccount,
  providerFolderId: string,
  name: string,
) {
  const auth = await getAuthedGoogleClient(account);
  const drive = google.drive({ version: 'v3', auth });
  await drive.files.update({ fileId: providerFolderId, requestBody: { name } });
}

export async function moveGoogleFolder(
  account: ConnectedAccount,
  providerFolderId: string,
  newParentId: string,
) {
  const auth = await getAuthedGoogleClient(account);
  const drive = google.drive({ version: 'v3', auth });
  const fileInfo = await drive.files.get({ fileId: providerFolderId, fields: 'parents' });
  const previousParents = fileInfo.data.parents?.join(',');
  await drive.files.update({
    fileId: providerFolderId,
    addParents: newParentId,
    removeParents: previousParents,
    fields: 'id, parents',
  });
}

export async function deleteGoogleDriveItem(account: ConnectedAccount, providerFileId: string) {
  const auth = await getAuthedGoogleClient(account);
  const drive = google.drive({ version: 'v3', auth });
  await drive.files.delete({ fileId: providerFileId });
}

// Mirrors files/stream-google-file.ts's googleDownloadExportMimeTypes (the non-preview variant).
// Kept as a separate table deliberately: streamGoogleFile (direct download/preview, used by
// GET /:id/download and /preview/:token) also has a preview-only override for spreadsheets
// that this fetcher's batch-download caller doesn't need, so unifying the tables would either
// bleed that override into batch-download or need a variant flag threaded through both call sites.
const driveDownloadExportMimeTypes: Record<string, { mimeType: string; extension: string }> = {
  'application/vnd.google-apps.document': { mimeType: 'application/pdf', extension: '.pdf' },
  'application/vnd.google-apps.spreadsheet': {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: '.xlsx',
  },
  'application/vnd.google-apps.presentation': { mimeType: 'application/pdf', extension: '.pdf' },
  'application/vnd.google-apps.drawing': { mimeType: 'image/png', extension: '.png' },
};

function withFileExtension(fileName: string, extension: string) {
  return fileName.toLowerCase().endsWith(extension) ? fileName : `${fileName}${extension}`;
}

export async function fetchGoogleFileStream(
  account: ConnectedAccount,
  file: { providerFileId: string; name: string; mimeType: string },
) {
  const auth = await getAuthedGoogleClient(account);
  const authHeaders = await auth.getRequestHeaders();
  const exportTarget = driveDownloadExportMimeTypes[file.mimeType];
  const fileName = exportTarget ? withFileExtension(file.name, exportTarget.extension) : file.name;
  const mimeType = exportTarget?.mimeType ?? file.mimeType;
  const url = exportTarget
    ? `https://www.googleapis.com/drive/v3/files/${file.providerFileId}/export?mimeType=${encodeURIComponent(exportTarget.mimeType)}`
    : `https://www.googleapis.com/drive/v3/files/${file.providerFileId}?alt=media`;
  const response = await fetch(url, { headers: authHeaders as HeadersInit });
  return { response, fileName, mimeType };
}
