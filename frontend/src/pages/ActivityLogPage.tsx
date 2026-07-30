import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/molecules/PageHeader';
import { ActivityTable } from '@/components/organisms/ActivityTable';
import { apiFetch } from '@/lib/api';
import type { AuditLog } from '@/lib/audit-log';

export function ActivityLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  async function loadLogs() {
    setLoading(true);
    try {
      const data = await apiFetch<{ logs: AuditLog[] }>('/audit-logs');
      setLogs(data.logs);
      setPage(1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs().catch(() => undefined);
  }, []);

  return (
    <>
      <PageHeader
        title="Activity Log"
        description="View audit trails and file activities across the Ithaca workspace."
      />

      <ActivityTable
        logs={logs}
        loading={loading}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
    </>
  );
}
