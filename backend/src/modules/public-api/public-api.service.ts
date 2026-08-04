import { bigintToString } from '../../utils/serialize.js';
import { HttpError } from '../../utils/http-error.js';
import * as publicApiRepository from './public-api.repository.js';

function toFileResponse(file: { sizeBytes: bigint }) {
  return { ...file, sizeBytes: bigintToString(file.sizeBytes) };
}

export async function listFiles(apiKey: { targetFileId: string | null; targetFolderId: string | null }) {
  if (apiKey.targetFileId) {
    const file = await publicApiRepository.findActiveFileById(apiKey.targetFileId);
    if (!file) throw new HttpError(404, 'FILE_NOT_FOUND', 'Pinned file not found.');
    return [toFileResponse(file)];
  }

  const files = await publicApiRepository.findActiveFiles(apiKey.targetFolderId);
  return files.map(toFileResponse);
}

export async function getFileForDownload(
  apiKey: { targetFileId: string | null; targetFolderId: string | null },
  fileId: string,
) {
  const file = await publicApiRepository.findFileByIdWithAccount(fileId);
  if (!file) throw new HttpError(404, 'FILE_NOT_FOUND', 'File not found.');

  const unrestricted = !apiKey.targetFileId && !apiKey.targetFolderId;
  const allowed =
    unrestricted ||
    file.id === apiKey.targetFileId ||
    (apiKey.targetFolderId !== null &&
      file.folderId === apiKey.targetFolderId &&
      file.status === 'active');
  if (!allowed) throw new HttpError(403, 'API_KEY_FORBIDDEN', 'API key is not scoped to this file.');

  return file;
}
