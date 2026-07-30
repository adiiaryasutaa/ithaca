import { useEffect, useState } from 'react';
import { RotateCcw, Trash2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/molecules/PageHeader';
import { apiFetch, formatBytes } from '@/lib/api';
import { confirmToast } from '@/lib/confirm-toast';

type TrashFile = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: string;
  provider: string;
  deletedAt: string;
  connectedAccount: {
    email: string;
    provider: string;
  };
};

export function TrashPage() {
  const [files, setFiles] = useState<TrashFile[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  async function loadTrash() {
    setLoading(true);
    try {
      const data = await apiFetch<{ files: TrashFile[] }>('/files/trash');
      setFiles(data.files);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load trash');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTrash().catch(() => undefined);
  }, []);

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  function toggleSelectAll() {
    if (selectedIds.size === files.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(files.map((f) => f.id)));
    }
  }

  async function handleRestore(ids: string[]) {
    if (ids.length === 0) return;
    setLoading(true);
    try {
      await apiFetch('/files/batch/restore', {
        method: 'POST',
        body: JSON.stringify({ fileIds: ids }),
      });
      setFiles((prev) => prev.filter((f) => !ids.includes(f.id)));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      toast.success(`Successfully restored ${ids.length} file(s).`);
      window.dispatchEvent(new Event('ithaca:storage-changed'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to restore files');
    } finally {
      setLoading(false);
    }
  }

  function handlePermanentDelete(ids: string[]) {
    if (ids.length === 0) return;
    confirmToast(
      `Are you sure you want to permanently delete ${ids.length} file(s)? This action cannot be undone.`,
      () => performPermanentDelete(ids),
      'Delete',
    );
  }

  async function performPermanentDelete(ids: string[]) {
    setLoading(true);
    try {
      await apiFetch('/files/batch/permanent', {
        method: 'DELETE',
        body: JSON.stringify({ fileIds: ids }),
      });
      setFiles((prev) => prev.filter((f) => !ids.includes(f.id)));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      toast.success(`Permanently deleted ${ids.length} file(s).`);
      window.dispatchEvent(new Event('ithaca:storage-changed'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to permanently delete files');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Recycle Bin"
        description="Manage deleted files. Restore them to active folders or delete them permanently."
        actions={
          selectedIds.size > 0 ? (
            <>
              <Button
                variant="outline"
                onClick={() => handleRestore(Array.from(selectedIds))}
                disabled={loading}
              >
                <RotateCcw className="h-4 w-4" /> Restore Selected ({selectedIds.size})
              </Button>
              <Button
                variant="destructive"
                onClick={() => handlePermanentDelete(Array.from(selectedIds))}
                disabled={loading}
              >
                <Trash2 className="h-4 w-4" /> Delete Selected ({selectedIds.size})
              </Button>
            </>
          ) : null
        }
      />

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
                    onChange={toggleSelectAll}
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
                      onChange={() => toggleSelect(file.id)}
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
                        onClick={() => handleRestore([file.id])}
                        disabled={loading}
                        title="Restore"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Restore
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handlePermanentDelete([file.id])}
                        disabled={loading}
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
    </>
  );
}
