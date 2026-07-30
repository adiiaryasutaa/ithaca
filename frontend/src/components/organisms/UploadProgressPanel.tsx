import { useState } from 'react';
import { CheckCircle, ChevronDown, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatBytes } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useUpload } from '@/context/UploadContext';

function barColor(status: string) {
  if (status === 'error' || status === 'partial') return 'h-full rounded-full bg-red-500';
  if (status === 'done') return 'h-full rounded-full bg-emerald-500';
  return 'h-full rounded-full bg-primary';
}

/** Fixed bottom-right panel driven entirely by UploadContext; renders nothing when closed. */
export function UploadProgressPanel() {
  const { uploadProgress, setUploadProgress, retryFailedUpload } = useUpload();
  const [collapsed, setCollapsed] = useState(false);

  if (!uploadProgress.open) return null;

  const { status, percent, fileName, files } = uploadProgress;
  const heading =
    status === 'done'
      ? 'Upload complete'
      : status === 'partial'
        ? 'Upload completed with errors'
        : status === 'error'
          ? 'Upload failed'
          : percent >= 99
            ? 'Processing on server'
            : 'Uploading files';

  return (
    <div className="fixed inset-x-3 bottom-3 z-30 max-h-[70dvh] overflow-hidden rounded-sm border border-border bg-card shadow-2xl shadow-slate-900/20 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[min(420px,calc(100vw-2.5rem))]">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 font-extrabold text-sm text-foreground">
          {status === 'done' ? (
            <CheckCircle className="h-5 w-5 text-emerald-500" />
          ) : status === 'partial' || status === 'error' ? (
            <X className="h-5 w-5 text-red-500" />
          ) : (
            <Upload className="h-5 w-5 text-primary" />
          )}
          {heading}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCollapsed(!collapsed)}
          >
            <ChevronDown
              className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setUploadProgress((current) => ({ ...current, open: false }))}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {!collapsed && (
        <div className="p-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <p className="truncate font-semibold">{fileName}</p>
            <span className="text-muted-foreground">{percent}%</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-muted">
            <div className={barColor(status)} style={{ width: `${percent}%` }} />
          </div>
          {files.length > 0 ? (
            <div className="mt-4 grid max-h-64 gap-3 overflow-y-auto pr-1 text-foreground">
              {files.map((file, index) => (
                <div
                  key={`${file.name}-${file.size}-${index}`}
                  className="grid gap-1 rounded-sm bg-muted p-3"
                >
                  <div className="flex min-w-0 items-center justify-between gap-3 text-sm">
                    <p className="min-w-0 flex-1 truncate font-semibold" title={file.name}>
                      {file.name}
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground">{file.percent}%</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>{formatBytes(file.size)}</span>
                    <div className="flex items-center gap-2">
                      {file.status === 'error' && (
                        <Button
                          variant="default"
                          className="h-6 px-2 text-[11px] font-extrabold text-white bg-primary shadow-none border-none"
                          onClick={() => retryFailedUpload(file.name)}
                        >
                          Retry
                        </Button>
                      )}
                      <span
                        className={
                          file.status === 'error'
                            ? 'font-semibold text-destructive'
                            : file.status === 'done'
                              ? 'font-semibold text-emerald-600'
                              : 'font-semibold text-primary'
                        }
                      >
                        {file.status === 'error'
                          ? 'Failed'
                          : file.status === 'done'
                            ? 'Done'
                            : file.percent >= 99
                              ? 'Processing'
                              : 'Uploading'}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-accent">
                    <div className={barColor(file.status)} style={{ width: `${file.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
