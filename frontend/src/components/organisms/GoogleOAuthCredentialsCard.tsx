import { useEffect, useState, type FormEvent } from 'react';
import { Cloud } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';

type GoogleConfig = {
  exists: boolean;
  clientId: string;
  redirectUri: string;
  hasSecret: boolean;
  defaultRedirectUri: string;
};

/**
 * Admin-only. Owns its own load/save against /system/google-config — the credentials are
 * global (a ProviderConfig row with a null userId) and nothing else on the page reads them.
 */
export function GoogleOAuthCredentialsCard() {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [defaultRedirectUri, setDefaultRedirectUri] = useState('');
  const [hasSecret, setHasSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    apiFetch<GoogleConfig>('/system/google-config')
      .then((config) => {
        if (config.exists) {
          setClientId(config.clientId || '');
          setRedirectUri(config.redirectUri || '');
          setHasSecret(config.hasSecret || false);
        }
        setDefaultRedirectUri(config.defaultRedirectUri || '');
      })
      .catch((error) => console.error('Failed to load global Google config', error));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch<{ message: string }>('/system/google-config', {
        method: 'POST',
        body: JSON.stringify({
          clientId,
          clientSecret: clientSecret || undefined,
          redirectUri: redirectUri || defaultRedirectUri,
        }),
      });
      toast.success(res.message || 'Google OAuth credentials saved.');
      setHasSecret(true);
      setClientSecret('');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to save Google OAuth configuration',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between border-b border-border dark:border-slate-800 pb-3 mb-4">
        <div className="flex items-center gap-2.5">
          <Cloud className="h-5 w-5 text-primary" />
          <h2 className="text-[17px] font-bold">Google OAuth Credentials</h2>
        </div>
        <Button variant="outline" size="sm" type="button" onClick={() => setShowHelp(!showHelp)}>
          {showHelp ? 'Hide Guide' : 'Setup Guide'}
        </Button>
      </div>

      {showHelp && (
        <div className="mb-4 rounded-sm bg-muted dark:bg-slate-900 p-3.5 text-[13px] leading-relaxed text-muted-foreground border border-border dark:border-slate-800">
          <p className="font-bold text-slate-800 dark:text-slate-200 mb-1.5">
            How to setup Google credentials:
          </p>
          <ol className="list-decimal pl-4 space-y-1.5">
            <li>
              Go to{' '}
              <a
                href="https://console.cloud.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Google Cloud Console
              </a>
              .
            </li>
            <li>
              Enable the <strong>Google Drive API</strong> in your project.
            </li>
            <li>
              Go to <strong>APIs &amp; Services &gt; Credentials</strong>, click{' '}
              <strong>Create Credentials &gt; OAuth client ID</strong>.
            </li>
            <li>
              Set application type to <strong>Web application</strong>.
            </li>
            <li>
              Add this exact URL under <strong>Authorized redirect URIs</strong>:
              <div className="mt-1 flex items-center gap-1.5 font-mono text-[11px] bg-card dark:bg-slate-950 p-1.5 rounded-sm border border-border dark:border-slate-800 select-all overflow-x-auto">
                {redirectUri || defaultRedirectUri}
              </div>
            </li>
            <li>
              Copy the generated <strong>Client ID</strong> and <strong>Client Secret</strong> into
              the form below and save.
            </li>
          </ol>
        </div>
      )}

      <form onSubmit={save} className="grid gap-3.5">
        <label className="grid gap-1.5 text-xs font-bold text-muted-foreground">
          Client ID
          <Input
            placeholder="Enter Google Client ID"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
          />
        </label>

        <label className="grid gap-1.5 text-xs font-bold text-muted-foreground">
          Client Secret{' '}
          {hasSecret && <span className="font-normal text-emerald-600">(Already Configured)</span>}
          <Input
            type="password"
            placeholder={hasSecret ? '••••••••••••••••••••••••' : 'Enter Google Client Secret'}
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            required={!hasSecret}
          />
        </label>

        <label className="grid gap-1.5 text-xs font-bold text-muted-foreground">
          Redirect URI (Optional)
          <Input
            placeholder={defaultRedirectUri}
            value={redirectUri}
            onChange={(e) => setRedirectUri(e.target.value)}
          />
        </label>

        <div className="flex justify-end mt-1">
          <Button type="submit" disabled={saving} size="sm">
            {saving ? 'Saving...' : 'Save Credentials'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
