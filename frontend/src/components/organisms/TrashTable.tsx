import { FileText, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatBytes } from '@/lib/api';

export type TrashFile = {
  id: string;
  name: string;
  sizeBytes: string;
  deletedAt: string;
  provider: string;
  connectedAccount: { email: string };
};

export function TrashTable({
  files,
  selectedIds,
  busy,
  onToggle,
  onToggleAll,
  onRestore,
  onPermanentDelete,
}: {
  files: TrashFile[];
  selectedIds: Set<string>;
  busy: boolean;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onRestore: (ids: string[]) => void;
  onPermanentDelete: (ids: string[]) => void;
}) {
  return (
    <Card className="mt-6 min-w-0 overflow-x-auto p-0">
      {files.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <Trash2 className="h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-base font-bold">Trash is empty</p>
          <p className="text-sm text-muted-foreground mt-1">Deleted files will appear here.</p>
        </div>
      ) : (
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase text-muted-foreground">
              <th className="w-9 px-4 py-3">
                <input
                  type="checkbox"
                  checked={selectedIds.size === files.length && files.length > 0}
                  onChange={onToggleAll}
                  className="rounded-sm border-input"
                />
              </th>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Account</th>
              <th className="px-4 py-3 font-semibold">Size</th>
              <th className="px-4 py-3 font-semibold">Deleted At</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <tr key={file.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(file.id)}
                    onChange={() => onToggle(file.id)}
                    className="rounded-sm border-input"
                  />
                </td>
                <td className="px-4 py-3 font-semibold text-foreground">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                    <span className="truncate max-w-xs sm:max-w-md block" title={file.name}>
                      {file.name}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {file.connectedAccount.email} ({file.provider})
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatBytes(file.sizeBytes)}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Intl.DateTimeFormat('en', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(file.deletedAt))}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRestore([file.id])}
                      disabled={busy}
                      title="Restore"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Restore
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onPermanentDelete([file.id])}
                      disabled={busy}
                      title="Delete Permanently"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
