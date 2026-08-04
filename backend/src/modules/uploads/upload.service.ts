import { Readable } from 'stream';
import { google } from 'googleapis';
import type { ConnectedAccount } from '@prisma/client';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { createAuditLog } from '../../utils/audit.js';
import {
  ensureGoogleAppFolder,
  getAuthedGoogleClient,
  makeGoogleFilePublic,
  syncGoogleQuota,
  uploadGoogleDriveFile,
} from '../google/google.service.js';
import {
  initResumableSession,
  putResumableChunk,
  queryResumableStatus,
} from '../google/google-resumable.service.js';
import {
  buildS3ObjectKey,
  getS3ConfigForAccount,
  syncS3Quota,
  uploadS3Object,
} from '../s3/s3.service.js';
import {
  getOrCreateRoutingPolicy,
  normalizePriorityAccountIds,
} from '../storage/routing-policy.service.js';
import * as uploadRepository from './upload.repository.js';

type RoutingMode = 'most_available' | 'round_robin' | 'priority';

export function logUpload(message: string, metadata?: Record<string, unknown>) {
  logger.info(metadata ?? {}, `[upload] ${message}`);
}

export function syncQuotaInBackground(accountId: string, sessionId: string) {
  logUpload('quota sync started', { accountId, sessionId });
  syncGoogleQuota(accountId)
    .then(() => logUpload('quota sync completed', { accountId, sessionId }))
    .catch((error) =>
      logUpload('quota sync failed', {
        accountId,
        sessionId,
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    );
}

export function byPriority<T extends { account: { id: string; createdAt: Date } }>(
  items: T[],
  priorityAccountIds: string[],
) {
  const order = new Map(priorityAccountIds.map((id, index) => [id, index]));
  return [...items].sort((a, b) => {
    const aOrder = order.get(a.account.id);
    const bOrder = order.get(b.account.id);
    if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder;
    if (aOrder !== undefined) return -1;
    if (bOrder !== undefined) return 1;
    return a.account.createdAt.getTime() - b.account.createdAt.getTime();
  });
}

export async function selectAccount(
  requestUserId: string,
  sizeBytes: bigint,
  reservedBytesByAccount = new Map<string, bigint>(),
  targetAccountId?: string | null,
) {
  const accounts = await uploadRepository.findConnectedAccountsForRouting(targetAccountId);

  const stale = accounts.filter(
    (account) =>
      !account.storageAccount?.lastSyncedAt ||
      account.storageAccount.lastSyncedAt.getTime() < Date.now() - 5 * 60_000,
  );
  await Promise.allSettled(
    stale.map(async (account) => {
      try {
        if (account.provider === 's3') {
          await syncS3Quota(account.id);
        } else {
          await syncGoogleQuota(account.id);
        }
      } catch (err: any) {
        logger.error(
          { err, accountId: account.id, email: account.email },
          '[upload] failed to sync quota for account',
        );
        await uploadRepository.setConnectedAccountLastError(
          account.id,
          err.message || 'Quota sync failed',
        );
      }
    }),
  );

  const fresh = await uploadRepository.findConnectedAccountsForRouting();

  const eligible = fresh
    .map((account) => ({
      account,
      availableBytes:
        account.storageAccount?.availableBytes === null ||
        account.storageAccount?.availableBytes === undefined
          ? null
          : account.storageAccount.availableBytes - (reservedBytesByAccount.get(account.id) ?? 0n),
    }))
    .filter(({ availableBytes }) => availableBytes === null || availableBytes >= sizeBytes);

  if (eligible.length === 0) return null;

  if (targetAccountId) {
    const target = eligible.find((e) => e.account.id === targetAccountId);
    return target?.account ?? null;
  }

  const policy = await getOrCreateRoutingPolicy(requestUserId);
  const mode = (
    ['most_available', 'round_robin', 'priority'].includes(policy.mode)
      ? policy.mode
      : 'most_available'
  ) as RoutingMode;
  const priorityAccountIds = normalizePriorityAccountIds(policy.priorityAccountIds);

  if (mode === 'priority') return byPriority(eligible, priorityAccountIds)[0]?.account ?? null;

  if (mode === 'round_robin') {
    const ordered = byPriority(eligible, priorityAccountIds);
    const selected =
      ordered[policy.roundRobinCursor % ordered.length]?.account ?? ordered[0]?.account ?? null;
    await uploadRepository.incrementRoutingPolicyCursor(policy.id, policy.roundRobinCursor + 1);
    return selected;
  }

  return eligible.sort((a, b) => {
    if (a.availableBytes === null && b.availableBytes === null)
      return a.account.provider === 's3' ? -1 : 1;
    if (a.availableBytes === null) return a.account.provider === 's3' ? -1 : 1;
    if (b.availableBytes === null) return b.account.provider === 's3' ? 1 : -1;
    return Number(b.availableBytes - a.availableBytes);
  })[0]?.account;
}

export async function resolveFolderPinnedAccountId(
  folderId: string | null,
): Promise<string | undefined> {
  if (!folderId) return undefined;
  const folderRecord = await uploadRepository.findActiveFolderById(folderId);
  return folderRecord.connectedAccountId ?? undefined;
}

async function resolveGoogleParentFolderId(account: ConnectedAccount, folderId: string | null) {
  const appFolderId = await ensureGoogleAppFolder(account);
  if (!folderId) return appFolderId;
  const folderRecord = await uploadRepository.findFolderById(folderId);
  return folderRecord?.providerFolderId ?? appFolderId;
}

export type UploadFileParams = {
  userId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: bigint;
  folderId: string | null;
  fileBuffer: Buffer;
  reservedBytesByAccount: Map<string, bigint>;
};

export type UploadFileResult =
  | { ok: true; file: Record<string, unknown> }
  | {
      ok: false;
      code: string;
      message: string;
      // Mirrors a pre-existing quirk: the original handler pushes the S3 provisional
      // file into `completed` right after upload, before the byte-mismatch check —
      // so a mismatched S3 upload ends up recorded in BOTH `completed` and `failed`.
      // Preserved here rather than "fixed" since this is a structural-only refactor.
      alsoCompletedFile?: Record<string, unknown>;
    };

export async function uploadBufferedFile(params: UploadFileParams): Promise<UploadFileResult> {
  const { userId, fileName, mimeType, sizeBytes, folderId, fileBuffer, reservedBytesByAccount } =
    params;

  const targetAccountId = await resolveFolderPinnedAccountId(folderId);

  const account = await selectAccount(userId, sizeBytes, reservedBytesByAccount, targetAccountId);
  if (!account)
    return {
      ok: false,
      code: 'NO_ACCOUNT_WITH_ENOUGH_SPACE',
      message: 'No connected storage account has enough space for this upload.',
    };
  reservedBytesByAccount.set(account.id, (reservedBytesByAccount.get(account.id) ?? 0n) + sizeBytes);

  const session = await uploadRepository.createUploadSession({
    userId,
    targetConnectedAccountId: account.id,
    folderId,
    fileName,
    mimeType,
    sizeBytes,
    status: 'uploading',
  });
  logUpload('file upload started', {
    sessionId: session.id,
    accountId: account.id,
    fileName,
    sizeBytes: sizeBytes.toString(),
  });

  const streamedBytes = BigInt(fileBuffer.length);

  let providerFileId = '';
  let s3FileId: string | null = null;
  let s3CompletedEntry: Record<string, unknown> | null = null;
  let uploadedName = fileName;
  let uploadedMimeType = mimeType;

  if (account.provider === 's3') {
    const config = await getS3ConfigForAccount(account.id);
    const provisionalFile = await uploadRepository.createProvisionalS3File({
      userId,
      connectedAccountId: account.id,
      folderId,
      fileName,
      mimeType,
      sizeBytes,
    });
    s3FileId = provisionalFile.id;
    providerFileId = buildS3ObjectKey(config, provisionalFile.id, fileName);
    await uploadS3Object(config, providerFileId, Readable.from(fileBuffer), mimeType);
    await uploadRepository.finalizeS3File(provisionalFile.id, providerFileId);
    s3CompletedEntry = {
      ...provisionalFile,
      providerFileId,
      status: 'active',
      sizeBytes: provisionalFile.sizeBytes.toString(),
    };
    logUpload('s3 upload completed', { sessionId: session.id, accountId: account.id, fileName });
  } else {
    const targetParentId = await resolveGoogleParentFolderId(account, folderId);
    const uploaded = await uploadGoogleDriveFile(account, {
      fileName,
      mimeType,
      parentId: targetParentId,
      body: Readable.from(fileBuffer),
    });
    providerFileId = uploaded.id;
    uploadedName = uploaded.name;
    uploadedMimeType = uploaded.mimeType;
    logUpload('google upload completed', { sessionId: session.id, accountId: account.id, fileName });

    try {
      const drive = google.drive({ version: 'v3', auth: await getAuthedGoogleClient(account) });
      await makeGoogleFilePublic(drive, providerFileId);
      logUpload('google file permissions set to public writer', {
        sessionId: session.id,
        providerFileId,
      });
    } catch (err: any) {
      logger.error({ err }, 'Failed to make Google Drive file public');
    }
  }

  if (streamedBytes !== sizeBytes) {
    if (s3FileId) await uploadRepository.softDeleteFile(s3FileId);
    await uploadRepository.updateUploadSession(session.id, {
      status: 'failed',
      errorMessage: 'Streamed byte count did not match declared size.',
    });
    return {
      ok: false,
      code: 'UPLOAD_SIZE_MISMATCH',
      message: 'Streamed byte count did not match declared size.',
      alsoCompletedFile: s3CompletedEntry ?? undefined,
    };
  }

  let resultFile: Record<string, unknown>;
  if (account.provider === 's3') {
    resultFile = s3CompletedEntry!;
  } else {
    const file = await uploadRepository.createGoogleFile({
      userId,
      connectedAccountId: account.id,
      folderId,
      providerFileId,
      name: uploadedName,
      mimeType: uploadedMimeType,
      sizeBytes,
    });
    logUpload('database file created', { sessionId: session.id, fileId: file.id, accountId: account.id });
    resultFile = { ...file, sizeBytes: file.sizeBytes.toString() };
  }

  await uploadRepository.updateUploadSession(session.id, {
    status: 'completed',
    completedAt: new Date(),
  });

  if (account.provider === 's3') syncS3Quota(account.id).catch(() => undefined);
  else syncQuotaInBackground(account.id, session.id);

  return { ok: true, file: resultFile };
}

export type InitResumableParams = {
  userId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: bigint;
  folderId: string | null;
  targetAccountId?: string | null;
};

export type InitResumableResult =
  | { ok: true; sessionId: string; provider: string; offset: 0 }
  | { ok: false; code: string; message: string };

export async function initResumableUpload(
  params: InitResumableParams,
): Promise<InitResumableResult> {
  if (params.sizeBytes <= 0n)
    return { ok: false, code: 'UPLOAD_SIZE_REQUIRED', message: 'Valid sizeBytes required.' };
  if (params.sizeBytes > BigInt(env.MAX_UPLOAD_BYTES))
    return { ok: false, code: 'UPLOAD_TOO_LARGE', message: 'File exceeds max upload size.' };

  const pinnedAccountId = await resolveFolderPinnedAccountId(params.folderId);
  const targetAccountId = pinnedAccountId ?? params.targetAccountId ?? undefined;

  const account = await selectAccount(params.userId, params.sizeBytes, undefined, targetAccountId);
  if (!account)
    return {
      ok: false,
      code: 'NO_ACCOUNT_WITH_ENOUGH_SPACE',
      message: 'No connected storage account has enough space.',
    };

  if (account.provider !== 'google_drive') {
    const session = await uploadRepository.createUploadSession({
      userId: params.userId,
      targetConnectedAccountId: account.id,
      folderId: params.folderId,
      fileName: params.fileName,
      mimeType: params.mimeType,
      sizeBytes: params.sizeBytes,
      status: 'uploading',
    });
    return { ok: true, sessionId: session.id, provider: account.provider, offset: 0 };
  }

  const auth = await getAuthedGoogleClient(account);
  const targetParentId = await resolveGoogleParentFolderId(account, params.folderId);
  const sessionUri = await initResumableSession(auth, {
    fileName: params.fileName,
    mimeType: params.mimeType,
    sizeBytes: params.sizeBytes,
    parentId: targetParentId,
  });

  const session = await uploadRepository.createUploadSession({
    userId: params.userId,
    targetConnectedAccountId: account.id,
    folderId: params.folderId,
    fileName: params.fileName,
    mimeType: params.mimeType,
    sizeBytes: params.sizeBytes,
    status: 'uploading',
    googleSessionUri: sessionUri,
  });
  return { ok: true, sessionId: session.id, provider: 'google_drive', offset: 0 };
}

export type ResumableStatusResponse =
  | { status: 'completed'; offset: string }
  | { status: 'uploading'; offset: string };

export async function getResumableStatus(sessionId: string): Promise<ResumableStatusResponse> {
  const session = await uploadRepository.findUploadSessionById(sessionId);

  if (session.status === 'completed') {
    return { status: 'completed', offset: session.sizeBytes.toString() };
  }

  if (!session.googleSessionUri || !session.targetConnectedAccountId) {
    return { status: 'uploading', offset: '0' };
  }

  const account = await uploadRepository.findConnectedAccountById(session.targetConnectedAccountId);
  const auth = await getAuthedGoogleClient(account);
  const result = await queryResumableStatus(auth, session.googleSessionUri, session.sizeBytes);

  if (result.status === 'completed')
    return { status: 'completed', offset: session.sizeBytes.toString() };
  return { status: 'uploading', offset: result.offset.toString() };
}

export type ResumableChunkParams = {
  userId: string;
  sessionId: string;
  rangeHeader: string;
  startByte: bigint;
  endByte: bigint;
  requestBody: unknown;
};

export type ResumableChunkResponse =
  | { kind: 'unsupported_provider' }
  | { kind: 'uploading'; offset: string }
  | { kind: 'completed'; file: Record<string, unknown> }
  | { kind: 'failed'; httpStatus: number; message: string };

export async function putResumableUploadChunk(
  params: ResumableChunkParams,
): Promise<ResumableChunkResponse> {
  const session = await uploadRepository.findUploadSessionById(params.sessionId);

  if (!session.googleSessionUri || !session.targetConnectedAccountId) {
    return { kind: 'unsupported_provider' };
  }

  const account = await uploadRepository.findConnectedAccountById(session.targetConnectedAccountId);
  const auth = await getAuthedGoogleClient(account);

  const result = await putResumableChunk(auth, session.googleSessionUri, {
    rangeHeader: params.rangeHeader,
    endByte: params.endByte,
    contentLength: params.endByte - params.startByte + 1n,
    body: params.requestBody,
  });

  if (result.status === 'uploading') {
    return { kind: 'uploading', offset: result.offset.toString() };
  }

  if (result.status === 'completed') {
    const fileMeta = result.file;

    try {
      const drive = google.drive({ version: 'v3', auth });
      await makeGoogleFilePublic(drive, fileMeta.id);
    } catch (err: any) {
      logger.error({ err }, 'Failed to make Google Drive resumable file public');
    }

    let existingFile = await uploadRepository.findFileByProviderFileId(fileMeta.id);
    if (!existingFile) {
      existingFile = await uploadRepository.createGoogleFile({
        userId: params.userId,
        connectedAccountId: account.id,
        folderId: session.folderId,
        providerFileId: fileMeta.id,
        name: fileMeta.name || session.fileName,
        mimeType: fileMeta.mimeType || session.mimeType,
        sizeBytes: session.sizeBytes,
      });
    }

    await uploadRepository.updateUploadSession(session.id, {
      status: 'completed',
      completedAt: new Date(),
    });

    await createAuditLog(params.userId, 'UPLOAD_FILE', 'file', existingFile.id, {
      name: existingFile.name,
      size: existingFile.sizeBytes.toString(),
    });

    syncQuotaInBackground(account.id, session.id);

    return {
      kind: 'completed',
      file: { ...existingFile, sizeBytes: existingFile.sizeBytes.toString() },
    };
  }

  await uploadRepository.updateUploadSession(session.id, {
    status: 'failed',
    errorMessage: result.message,
  });
  return { kind: 'failed', httpStatus: result.httpStatus, message: result.message };
}
