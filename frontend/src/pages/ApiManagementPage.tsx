import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle, KeyRound, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/molecules/PageHeader';
import { StatTile } from '@/components/molecules/StatTile';
import { ReadApiDocs, UploadApiDocs } from '@/components/organisms/ApiDocsCards';
import { ApiKeyList } from '@/components/organisms/ApiKeyList';
import { ApiSecretBanner } from '@/components/organisms/ApiSecretBanner';
import {
  CreateApiKeyDialog,
  emptyApiKeyDraft,
  type ApiKeyDraft,
} from '@/components/organisms/CreateApiKeyDialog';
import { apiFetch } from '@/lib/api';
import type { ApiKey } from '@/lib/api-keys';

type NamedOption = { id: string; name: string };

export function ApiManagementPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<ApiKeyDraft>(emptyApiKeyDraft);
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [allFolders, setAllFolders] = useState<NamedOption[]>([]);
  const [allFiles, setAllFiles] = useState<NamedOption[]>([]);

  async function load() {
    const data = await apiFetch<{ apiKeys: ApiKey[] }>('/api-keys');
    setApiKeys(data.apiKeys);
  }

  async function loadTargets() {
    const [folderData, fileData] = await Promise.all([
      apiFetch<{ folders: NamedOption[] }>('/folders?all=1'),
      apiFetch<{ files: NamedOption[] }>('/files'),
    ]);
    setAllFolders(folderData.folders);
    setAllFiles(fileData.files);
  }

  useEffect(() => {
    Promise.all([load(), loadTargets()]).catch((error) =>
      toast.error(error instanceof Error ? error.message : 'Failed to load API keys'),
    );
  }, []);

  async function createKey(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const payload: Record<string, unknown> = { name: draft.name, mode: draft.mode };
      if (draft.mode === 'upload') {
        if (draft.targetFolderId) payload.targetFolderId = draft.targetFolderId;
      } else if (draft.targetKind === 'folder' && draft.targetFolderId) {
        payload.targetFolderId = draft.targetFolderId;
      } else if (draft.targetKind === 'file' && draft.targetFileId) {
        payload.targetFileId = draft.targetFileId;
      }
      const data = await apiFetch<{ apiKey: ApiKey; secret: string }>('/api-keys', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setSecret(data.secret);
      setDraft(emptyApiKeyDraft);
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
      <ApiSecretBanner secret={secret} />

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <StatTile
          icon={KeyRound}
          value={apiKeys.filter((apiKey) => apiKey.status === 'active').length}
          label="Active keys"
        />
        <StatTile
          icon={CheckCircle}
          iconClassName="text-emerald-600"
          value={apiKeys.filter((apiKey) => apiKey.lastUsedAt).length}
          label="Used keys"
        />
        <StatTile icon={UploadCloud} value={3} label="Public API endpoints" />
      </div>

      <div className="mt-6 grid gap-6">
        <ApiKeyList apiKeys={apiKeys} onCreate={() => setCreateOpen(true)} onRevoke={revokeKey} />
        <UploadApiDocs />
        <ReadApiDocs />
      </div>

      <CreateApiKeyDialog
        open={createOpen}
        draft={draft}
        folders={allFolders}
        files={allFiles}
        submitting={loading}
        onChange={setDraft}
        onSubmit={createKey}
        onClose={() => {
          setCreateOpen(false);
          setDraft(emptyApiKeyDraft);
        }}
      />
    </>
  );
}
