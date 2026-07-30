import { Clipboard, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { copyText } from '@/lib/clipboard';

/** Shown once, right after creation — the raw secret is never stored server-side. */
export function ApiSecretBanner({ secret }: { secret: string }) {
  if (!secret) return null;
  return (
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
          <Button className="w-full lg:w-auto" type="button" onClick={() => copyText(secret)}>
            <Clipboard className="h-4 w-4" />
            Copy key
          </Button>
        </div>
      </div>
    </Card>
  );
}
