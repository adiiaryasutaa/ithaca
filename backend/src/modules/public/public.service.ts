import { hashToken } from '../../utils/crypto.js';
import * as publicRepository from './public.repository.js';

export async function getSharedFile(token: string) {
  const share = await publicRepository.findEnabledShareByTokenOrHash(token, hashToken(token));
  if (!share || share.file.status !== 'active') throw new Error('Shared file not found');
  return share.file;
}

export function toSharedFileMetadata(file: { id: string; name: string; mimeType: string; sizeBytes: bigint; createdAt: Date }) {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes.toString(),
    createdAt: file.createdAt,
  };
}
