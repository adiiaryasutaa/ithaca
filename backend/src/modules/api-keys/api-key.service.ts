import { hashToken, randomToken } from '../../utils/crypto.js';
import * as apiKeyRepository from './api-key.repository.js';

export function serializeApiKey(apiKey: {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: unknown;
  status: string;
  targetFolderId: string | null;
  targetFileId: string | null;
  targetFolder?: { id: string; name: string } | null;
  targetFile?: { id: string; name: string } | null;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}) {
  const scopes = Array.isArray(apiKey.scopes) ? apiKey.scopes : [];
  return {
    id: apiKey.id,
    name: apiKey.name,
    keyPrefix: apiKey.keyPrefix,
    scopes,
    mode: scopes.includes('files:read') ? 'read' : 'upload',
    status: apiKey.status,
    targetFolderId: apiKey.targetFolderId,
    targetFileId: apiKey.targetFileId,
    targetFolder: apiKey.targetFolder ?? null,
    targetFile: apiKey.targetFile ?? null,
    lastUsedAt: apiKey.lastUsedAt?.toISOString() ?? null,
    expiresAt: apiKey.expiresAt?.toISOString() ?? null,
    revokedAt: apiKey.revokedAt?.toISOString() ?? null,
    createdAt: apiKey.createdAt.toISOString(),
  };
}

export async function listApiKeys() {
  const apiKeys = await apiKeyRepository.findAllApiKeys();
  return apiKeys.map(serializeApiKey);
}

export async function createApiKey(
  userId: string,
  body: {
    name: string;
    expiresAt?: string | null;
    mode: 'upload' | 'read';
    targetFolderId?: string | null;
    targetFileId?: string | null;
  },
) {
  const targetFolderId = body.targetFolderId || null;
  const targetFileId = body.targetFileId || null;

  if (targetFolderId) await apiKeyRepository.findActiveFolderByIdOrThrow(targetFolderId);
  if (targetFileId) await apiKeyRepository.findActiveFileByIdOrThrow(targetFileId);

  const scopes = body.mode === 'read' ? ['files:read'] : ['files:upload'];
  const secret = `9d_live_${randomToken(32)}`;
  const apiKey = await apiKeyRepository.createApiKey({
    userId,
    name: body.name,
    keyPrefix: secret.slice(0, 16),
    keyHash: hashToken(secret),
    scopes,
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    targetFolderId,
    targetFileId,
  });
  return { apiKey: serializeApiKey(apiKey), secret };
}

export async function revokeApiKey(id: string) {
  await apiKeyRepository.revokeApiKeyById(id);
}
