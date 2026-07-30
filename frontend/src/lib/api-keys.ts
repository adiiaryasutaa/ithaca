export type ApiKeyTarget = { id: string; name: string };

export type ApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  mode: 'upload' | 'read';
  status: string;
  targetFolderId: string | null;
  targetFileId: string | null;
  targetFolder: ApiKeyTarget | null;
  targetFile: ApiKeyTarget | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};
