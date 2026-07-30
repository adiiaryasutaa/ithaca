import { useEffect, useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/molecules/PageHeader';
import { TrashTable, type TrashFile } from '@/components/organisms/TrashTable';
import { apiFetch } from '@/lib/api';
import { confirmToast } from '@/lib/confirm-toast';

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

      <TrashTable
        files={files}
        selectedIds={selectedIds}
        busy={loading}
        onToggle={toggleSelect}
        onToggleAll={toggleSelectAll}
        onRestore={handleRestore}
        onPermanentDelete={handlePermanentDelete}
      />
    </>
  );
}
