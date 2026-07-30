import { X } from 'lucide-react';
import { formatBytes } from '@/lib/api';

export function UploadFileList({
  files,
  onRemove,
}: {
  files: File[];
  onRemove: (index: number) => void;
}) {
  if (files.length === 0) return null;
  return (
    <div className="grid max-h-56 gap-2 overflow-y-auto rounded-sm bg-muted p-3 text-sm text-muted-foreground">
      <div className="flex items-center justify-between gap-3">
        <span className="font-bold text-foreground">{files.length} selected</span>
        <span className="shrink-0">
          {formatBytes(files.reduce((total, file) => total + file.size, 0))}
        </span>
      </div>
      {files.map((file, index) => (
        <div
          key={`${file.name}-${file.size}-${index}`}
          className="flex min-w-0 items-center justify-between gap-3 rounded-sm bg-card px-3 py-2"
        >
          <span className="min-w-0 flex-1 truncate" title={file.name}>
            {file.name}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(file.size)}</span>
          <button
            type="button"
            className="shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => onRemove(index)}
            aria-label={`Remove ${file.name}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
