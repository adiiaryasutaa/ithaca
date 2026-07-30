import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle, Clipboard, KeyRound, ShieldCheck, Trash2, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { DummyModal } from '@/components/molecules/DummyModal';
import { PageHeader } from '@/components/molecules/PageHeader';
import { API_URL, apiFetch, formatDate } from '@/lib/api';

type ApiKeyTarget = { id: string; name: string };
type ApiKey = {
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
type FolderOption = { id: string; name: string };
type FileOption = { id: string; name: string };

const curlExample = `curl -X POST "${API_URL}/api/v1/uploads" \\
  -H "Authorization: Bearer 9d_live_xxx" \\
  -F 'filesMeta=[{"fieldName":"file-0","fileName":"hello.txt","mimeType":"text/plain","sizeBytes":"12"}]' \\
  -F "file-0=@hello.txt;type=text/plain"`;

const jsExample = `const form = new FormData()
form.append('filesMeta', JSON.stringify([
  { fieldName: 'file-0', fileName: file.name, mimeType: file.type, sizeBytes: String(file.size) },
]))
form.append('file-0', file)

await fetch('${API_URL}/api/v1/uploads', {
  method: 'POST',
  headers: { Authorization: 'Bearer 9d_live_xxx' },
  body: form,
})`;

const readCurlExample = `curl "${API_URL}/api/v1/files" \\
  -H "Authorization: Bearer 9d_live_xxx"`;

const downloadCurlExample = `curl -OJ "${API_URL}/api/v1/files/<file-id>/download" \\
  -H "Authorization: Bearer 9d_live_xxx"`;

export function ApiManagementPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [allFolders, setAllFolders] = useState<FolderOption[]>([]);
  const [allFiles, setAllFiles] = useState<FileOption[]>([]);
  const [mode, setMode] = useState<'upload' | 'read'>('upload');
  const [targetKind, setTargetKind] = useState<'none' | 'folder' | 'file'>('none');
  const [targetFolderId, setTargetFolderId] = useState('');
  const [targetFileId, setTargetFileId] = useState('');

  async function load() {
    const data = await apiFetch<{ apiKeys: ApiKey[] }>('/api-keys');
    setApiKeys(data.apiKeys);
  }

  async function loadTargets() {
    const [folderData, fileData] = await Promise.all([
      apiFetch<{ folders: FolderOption[] }>('/folders?all=1'),
      apiFetch<{ files: FileOption[] }>('/files'),
    ]);
    setAllFolders(folderData.folders);
    setAllFiles(fileData.files);
  }

  useEffect(() => {
    Promise.all([load(), loadTargets()]).catch((error) =>
      toast.error(error instanceof Error ? error.message : 'Failed to load API keys'),
    );
  }, []);

  function resetTargetFields() {
    setMode('upload');
    setTargetKind('none');
    setTargetFolderId('');
    setTargetFileId('');
  }

  async function createKey(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const payload: Record<string, unknown> = { name: keyName, mode };
      if (mode === 'upload') {
        if (targetFolderId) payload.targetFolderId = targetFolderId;
      } else if (targetKind === 'folder' && targetFolderId) {
        payload.targetFolderId = targetFolderId;
      } else if (targetKind === 'file' && targetFileId) {
        payload.targetFileId = targetFileId;
      }
      const data = await apiFetch<{ apiKey: ApiKey; secret: string }>('/api-keys', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setSecret(data.secret);
      setKeyName('');
      resetTargetFields();
      setCreateOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create API key');
    } finally {
      setLoading(false);
    }
  }

  async function revokeKey(id: string) {
    await apiFetch(`/api-keys/${id}`, { method: 'DELETE' });
    await load();
  }

  function copy(value: string) {
    navigator.clipboard
      .writeText(value)
      .then(() => toast.success('Copied to clipboard.'))
      .catch(() => toast.error('Failed to copy.'));
  }

  const activeKeys = apiKeys.filter((apiKey) => apiKey.status === 'active').length;
  const usedKeys = apiKeys.filter((apiKey) => apiKey.lastUsedAt).length;

  return (
    <>
      <PageHeader
        title="API Management"
        description="Create API keys, copy examples, and upload files from external apps."
        actions={
          <Button className="col-span-2 w-full sm:w-auto" onClick={() => setCreateOpen(true)}>
            <KeyRound className="h-4 w-4" />
            Create API Key
          </Button>
        }
      />
      {secret ? (
        <Card className="mt-5 min-w-0 overflow-hidden border-primary/20 bg-primary/10 p-0">
          <div className="grid min-w-0 gap-4 p-4 sm:p-5">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-primary text-white">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-extrabold text-blue-950">Copy your API key now</p>
                <p className="mt-1 text-sm text-primary">
                  This secret is shown once. Store it securely before closing this page.
                </p>
              </div>
            </div>
            <div className="grid min-w-0 gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
              <code className="block min-w-0 max-w-full overflow-x-auto rounded-sm bg-card p-3 text-xs font-semibold text-foreground sm:text-sm">
                {secret}
              </code>
              <Button className="w-full lg:w-auto" type="button" onClick={() => copy(secret)}>
                <Clipboard className="h-4 w-4" />
                Copy key
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <KeyRound className="h-5 w-5 text-primary" />
          <p className="mt-3 text-2xl font-extrabold">{activeKeys}</p>
          <p className="text-sm text-muted-foreground">Active keys</p>
        </Card>
        <Card className="p-4">
          <CheckCircle className="h-5 w-5 text-emerald-600" />
          <p className="mt-3 text-2xl font-extrabold">{usedKeys}</p>
          <p className="text-sm text-muted-foreground">Used keys</p>
        </Card>
        <Card className="p-4">
          <UploadCloud className="h-5 w-5 text-primary" />
          <p className="mt-3 text-2xl font-extrabold">3</p>
          <p className="text-sm text-muted-foreground">Public API endpoints</p>
        </Card>
      </div>

      <div className="mt-6 grid gap-6">
        <Card className="min-w-0 p-4 sm:p-5">
          <div>
            <h2 className="text-lg font-extrabold">API Keys</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Keys can only upload files. Raw secrets are never stored.
            </p>
          </div>
          <div className="mt-4 grid gap-3">
            {apiKeys.length === 0 ? (
              <div className="rounded-sm border border-dashed border-input p-5 text-center sm:p-6">
                <KeyRound className="mx-auto h-8 w-8 text-primary" />
                <p className="mt-3 font-extrabold">No API keys yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create one key, copy it once, then use the docs below.
                </p>
                <Button className="mt-4 w-full sm:w-auto" onClick={() => setCreateOpen(true)}>
                  Create API Key
                </Button>
              </div>
            ) : (
              apiKeys.map((apiKey) => (
                <div
                  key={apiKey.id}
                  className="grid min-w-0 gap-4 rounded-sm bg-muted p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="min-w-0 break-words font-semibold text-foreground">
                        {apiKey.name}
                      </p>
                      <span
                        className={
                          apiKey.status === 'active'
                            ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-600'
                            : 'rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-muted-foreground'
                        }
                      >
                        {apiKey.status}
                      </span>
                    </div>
                    <div className="mt-2 grid min-w-0 gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                      <p className="min-w-0 truncate">
                        <span className="font-semibold text-foreground">Prefix:</span>{' '}
                        {apiKey.keyPrefix}...
                      </p>
                      <p className="min-w-0 break-words">
                        <span className="font-semibold text-foreground">Created:</span>{' '}
                        {formatDate(apiKey.createdAt)}
                      </p>
                      <p className="min-w-0 break-words">
                        <span className="font-semibold text-foreground">Last used:</span>{' '}
                        {apiKey.lastUsedAt ? formatDate(apiKey.lastUsedAt) : 'Never'}
                      </p>
                      <p className="min-w-0 break-words">
                        <span className="font-semibold text-foreground">Scope:</span>{' '}
                        {apiKey.scopes.join(', ')}
                      </p>
                      <p className="min-w-0 break-words">
                        <span className="font-semibold text-foreground">Mode:</span> {apiKey.mode}
                      </p>
                      <p className="min-w-0 break-words">
                        <span className="font-semibold text-foreground">Pinned to:</span>{' '}
                        {apiKey.targetFolder?.name ?? apiKey.targetFile?.name ?? 'Unrestricted'}
                      </p>
                    </div>
                  </div>
                  <Button
                    className="w-full lg:w-auto"
                    variant="destructive"
                    onClick={() => revokeKey(apiKey.id)}
                    disabled={apiKey.status === 'revoked'}
                  >
                    <Trash2 className="h-4 w-4" />
                    Revoke
                  </Button>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="min-w-0 p-4 sm:p-5">
          <div>
            <h2 className="text-lg font-extrabold">Upload API Docs</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Multipart upload uses the same storage routing as dashboard uploads. If a key is
              pinned to a folder, <code className="text-xs">folderId</code> must match the pinned
              folder or be omitted — a mismatched value returns{' '}
              <code className="text-xs">403 API_KEY_FOLDER_MISMATCH</code>.
            </p>
          </div>
          <div className="mt-4 grid gap-4 text-sm text-muted-foreground">
            <div className="min-w-0">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="font-bold text-foreground">Endpoint</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copy(`${API_URL}/api/v1/uploads`)}
                >
                  <Clipboard className="h-4 w-4" />
                  Copy
                </Button>
              </div>
              <code className="block min-w-0 max-w-full overflow-x-auto rounded-sm bg-muted p-3 text-xs text-foreground sm:text-sm">
                POST {API_URL}/api/v1/uploads
              </code>
            </div>
            <div className="min-w-0">
              <p className="font-bold text-foreground">Auth Header</p>
              <code className="mt-2 block min-w-0 max-w-full overflow-x-auto rounded-sm bg-muted p-3 text-xs text-foreground sm:text-sm">
                Authorization: Bearer 9d_live_xxx
              </code>
            </div>
            <div className="min-w-0">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="font-bold text-foreground">cURL</p>
                <Button variant="outline" size="sm" onClick={() => copy(curlExample)}>
                  <Clipboard className="h-4 w-4" />
                  Copy
                </Button>
              </div>
              <pre className="max-h-72 max-w-full overflow-auto rounded-sm bg-slate-950 p-3 text-xs leading-relaxed text-white">
                {curlExample}
              </pre>
            </div>
            <div className="min-w-0">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="font-bold text-foreground">JavaScript</p>
                <Button variant="outline" size="sm" onClick={() => copy(jsExample)}>
                  <Clipboard className="h-4 w-4" />
                  Copy
                </Button>
              </div>
              <pre className="max-h-72 max-w-full overflow-auto rounded-sm bg-slate-950 p-3 text-xs leading-relaxed text-white">
                {jsExample}
              </pre>
            </div>
          </div>
        </Card>

        <Card className="min-w-0 p-4 sm:p-5">
          <div>
            <h2 className="text-lg font-extrabold">Read API Docs</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Read-mode keys can list and download files. Pinned keys only see their pinned file or
              the direct contents of their pinned folder.
            </p>
          </div>
          <div className="mt-4 grid gap-4 text-sm text-muted-foreground">
            <div className="min-w-0">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="font-bold text-foreground">List files</p>
                <Button variant="outline" size="sm" onClick={() => copy(readCurlExample)}>
                  <Clipboard className="h-4 w-4" />
                  Copy
                </Button>
              </div>
              <pre className="max-h-72 max-w-full overflow-auto rounded-sm bg-slate-950 p-3 text-xs leading-relaxed text-white">
                {readCurlExample}
              </pre>
            </div>
            <div className="min-w-0">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="font-bold text-foreground">Download a file</p>
                <Button variant="outline" size="sm" onClick={() => copy(downloadCurlExample)}>
                  <Clipboard className="h-4 w-4" />
                  Copy
                </Button>
              </div>
              <pre className="max-h-72 max-w-full overflow-auto rounded-sm bg-slate-950 p-3 text-xs leading-relaxed text-white">
                {downloadCurlExample}
              </pre>
            </div>
          </div>
        </Card>
      </div>

      <DummyModal
        open={createOpen}
        title="Create API Key"
        description="Upload keys can be pinned to a folder; read keys can be pinned to a file or folder."
        onClose={() => setCreateOpen(false)}
      >
        <form className="grid gap-4" onSubmit={createKey}>
          <Input
            placeholder="Key name"
            value={keyName}
            onChange={(event) => setKeyName(event.target.value)}
            required
          />
          <label className="grid gap-2 text-sm font-semibold">
            Mode
            <Combobox
              className="h-7"
              searchable={false}
              value={mode}
              onValueChange={(value) => {
                setMode(value as 'upload' | 'read');
                setTargetKind('none');
                setTargetFolderId('');
                setTargetFileId('');
              }}
              options={[
                { value: 'upload', label: 'Upload (pin to folder)' },
                { value: 'read', label: 'Read (pin to file or folder)' },
              ]}
            />
          </label>

          {mode === 'upload' ? (
            <label className="grid gap-2 text-sm font-semibold">
              Pinned Folder
              <Combobox
                className="h-7"
                value={targetFolderId}
                onValueChange={setTargetFolderId}
                placeholder="No folder (unrestricted)"
                options={[
                  { value: '', label: 'No folder (unrestricted)' },
                  ...allFolders.map((folder) => ({ value: folder.id, label: folder.name })),
                ]}
              />
            </label>
          ) : (
            <>
              <label className="grid gap-2 text-sm font-semibold">
                Pin To
                <Combobox
                  className="h-7"
                  searchable={false}
                  value={targetKind}
                  onValueChange={(value) => {
                    setTargetKind(value as 'none' | 'folder' | 'file');
                    setTargetFolderId('');
                    setTargetFileId('');
                  }}
                  options={[
                    { value: 'none', label: 'Nothing (unrestricted)' },
                    { value: 'folder', label: 'A folder' },
                    { value: 'file', label: 'A file' },
                  ]}
                />
              </label>
              {targetKind === 'folder' ? (
                <label className="grid gap-2 text-sm font-semibold">
                  Folder
                  <Combobox
                    className="h-7"
                    value={targetFolderId}
                    onValueChange={setTargetFolderId}
                    placeholder="Select a folder"
                    options={allFolders.map((folder) => ({ value: folder.id, label: folder.name }))}
                  />
                </label>
              ) : null}
              {targetKind === 'file' ? (
                <label className="grid gap-2 text-sm font-semibold">
                  File
                  <Combobox
                    className="h-7"
                    value={targetFileId}
                    onValueChange={setTargetFileId}
                    placeholder="Select a file"
                    options={allFiles.map((file) => ({ value: file.id, label: file.name }))}
                  />
                </label>
              ) : null}
            </>
          )}

          <div className="grid gap-3 sm:flex sm:justify-end">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setCreateOpen(false);
                resetTargetFields();
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Key'}
            </Button>
          </div>
        </form>
      </DummyModal>
    </>
  );
}
