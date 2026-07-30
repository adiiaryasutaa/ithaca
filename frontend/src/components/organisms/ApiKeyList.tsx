import { KeyRound, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatDate } from '@/lib/api';
import type { ApiKey } from '@/lib/api-keys';

export function ApiKeyList({
  apiKeys,
  onCreate,
  onRevoke,
}: {
  apiKeys: ApiKey[];
  onCreate: () => void;
  onRevoke: (id: string) => void;
}) {
  return (
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
            <Button className="mt-4 w-full sm:w-auto" onClick={onCreate}>
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
                  <p className="min-w-0 break-words font-semibold text-foreground">{apiKey.name}</p>
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
                  <Field label="Prefix" value={`${apiKey.keyPrefix}...`} truncate />
                  <Field label="Created" value={formatDate(apiKey.createdAt)} />
                  <Field
                    label="Last used"
                    value={apiKey.lastUsedAt ? formatDate(apiKey.lastUsedAt) : 'Never'}
                  />
                  <Field label="Scope" value={apiKey.scopes.join(', ')} />
                  <Field label="Mode" value={apiKey.mode} />
                  <Field
                    label="Pinned to"
                    value={apiKey.targetFolder?.name ?? apiKey.targetFile?.name ?? 'Unrestricted'}
                  />
                </div>
              </div>
              <Button
                className="w-full lg:w-auto"
                variant="destructive"
                onClick={() => onRevoke(apiKey.id)}
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
  );
}

function Field({ label, value, truncate }: { label: string; value: string; truncate?: boolean }) {
  return (
    <p className={truncate ? 'min-w-0 truncate' : 'min-w-0 break-words'}>
      <span className="font-semibold text-foreground">{label}:</span> {value}
    </p>
  );
}
