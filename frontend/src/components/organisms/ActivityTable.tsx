import { FileText, Folder, History, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TablePagination } from '@/components/molecules/TablePagination';
import { formatDate } from '@/lib/api';
import { describeLog, getActionBadge, type AuditLog } from '@/lib/audit-log';
import { cn } from '@/lib/utils';

export function ActivityTable({
  logs,
  loading,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  logs: AuditLog[];
  loading: boolean;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  // The audit endpoint returns the whole log, so paging happens client-side.
  const totalPages = Math.max(1, Math.ceil(logs.length / pageSize));
  const pagedLogs = logs.slice((page - 1) * pageSize, page * pageSize);

  return (
    <Card className="mt-8 overflow-hidden p-0">
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <RefreshCw className="mb-2 h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Loading activity logs...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <History className="mb-3 h-12 w-12 stroke-[1.5] text-muted-foreground" />
          <p className="font-semibold text-muted-foreground">No activity yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Actions performed on workspace folders and files will appear here.
          </p>
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead className="text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedLogs.map((log) => {
                const badge = getActionBadge(log.action);
                const EntityIcon = log.entityType === 'folder' ? Folder : FileText;
                const { title, subtitle } = describeLog(log);
                return (
                  <TableRow key={log.id}>
                    <TableCell>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase',
                          badge.color,
                        )}
                      >
                        <badge.icon className="h-3 w-3" />
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-72 whitespace-normal">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        <EntityIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{title}</span>
                      </div>
                      {subtitle ? (
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {subtitle}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{log.actorEmail ?? '—'}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatDate(log.createdAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <TablePagination
            page={page}
            pageSize={pageSize}
            totalPages={totalPages}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </>
      )}
    </Card>
  );
}
