import { Clipboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { copyText } from '@/lib/clipboard';

/**
 * A labelled snippet with an optional copy button. `tone="inline"` is the muted single-line
 * style used for endpoints and headers; `tone="terminal"` is the dark multi-line block.
 */
export function CodeBlock({
  label,
  code,
  copyValue,
  tone = 'terminal',
  copyable = true,
}: {
  label: string;
  code: string;
  /** Copied instead of `code` when the displayed text carries extra prose (e.g. a verb). */
  copyValue?: string;
  tone?: 'inline' | 'terminal';
  copyable?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="font-bold text-foreground">{label}</p>
        {copyable ? (
          <Button variant="outline" size="sm" onClick={() => copyText(copyValue ?? code)}>
            <Clipboard className="h-4 w-4" />
            Copy
          </Button>
        ) : null}
      </div>
      {tone === 'inline' ? (
        <code className="block min-w-0 max-w-full overflow-x-auto rounded-sm bg-muted p-3 text-xs text-foreground sm:text-sm">
          {code}
        </code>
      ) : (
        <pre className="max-h-72 max-w-full overflow-auto rounded-sm bg-slate-950 p-3 text-xs leading-relaxed text-white">
          {code}
        </pre>
      )}
    </div>
  );
}
