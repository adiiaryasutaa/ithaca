import { useEffect, useState } from 'react';
import { History, Plus, Trash2, RefreshCw, Folder, FileText, Download, Move } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/molecules/PageHeader';
import { apiFetch, formatDate } from '@/lib/api';
import { cn } from '@/lib/utils';

type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: string | any | null;
  actorEmail: string | null;
  createdAt: string;
};

const PAGE_SIZE_OPTIONS = ['10', '25', '50', '100'];

function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  const pages: (number | 'ellipsis')[] = [1];
  if (current > 3) pages.push('ellipsis');
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    pages.push(p);
  }
  if (current < total - 2) pages.push('ellipsis');
  if (total > 1) pages.push(total);
  return pages;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getActionBadge(action: string) {
  const act = action.toUpperCase();
  if (act.includes('CREATE') || act.includes('UPLOAD')) {
    return { color: 'bg-emerald-500/10 text-emerald-600', icon: Plus };
  }
  if (act.includes('DELETE') || act.includes('PERMANENT') || act.includes('TRASH')) {
    return { color: 'bg-rose-500/10 text-rose-600', icon: Trash2 };
  }
  if (act.includes('RESTORE') || act.includes('SYNC')) {
    return { color: 'bg-amber-500/10 text-amber-600', icon: RefreshCw };
  }
  if (act.includes('MOVE')) {
    return { color: 'bg-indigo-500/10 text-indigo-600', icon: Move };
  }
  if (act.includes('DOWNLOAD')) {
    return { color: 'bg-primary/10 text-primary', icon: Download };
  }
  return { color: 'bg-foreground/10 text-muted-foreground', icon: History };
}

function describeLog(log: AuditLog): { title: string; subtitle: string | null } {
  let parsed: any = log.metadata;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return { title: log.entityType, subtitle: parsed || null };
    }
  }
  if (!parsed || typeof parsed !== 'object') {
    return { title: log.entityType, subtitle: null };
  }

  const name = parsed.name || parsed.fileName || parsed.folderName;
  if (name) {
    const extras: string[] = [];
    if (parsed.count !== undefined) extras.push(`${parsed.count} items`);
    if (parsed.sizeBytes !== undefined) extras.push(formatBytes(Number(parsed.sizeBytes)));
    return { title: name, subtitle: extras.length > 0 ? extras.join(' · ') : null };
  }

  if (Object.keys(parsed).length > 0) {
    return { title: log.entityType, subtitle: JSON.stringify(parsed) };
  }
  return { title: log.entityType, subtitle: null };
}

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

  const totalPages = Math.max(1, Math.ceil(logs.length / pageSize));
  const pagedLogs = logs.slice((page - 1) * pageSize, page * pageSize);

  return (
    <>
      <PageHeader
        title="Activity Log"
        description="View audit trails and file activities across the Ithaca workspace."
      />

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
                      <TableCell className="text-muted-foreground">
                        {log.actorEmail ?? '—'}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatDate(log.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div className="flex flex-col-reverse items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Rows per page
                <Select
                  items={PAGE_SIZE_OPTIONS.map((option) => ({ value: option, label: option }))}
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    setPageSize(Number(value));
                    setPage(1);
                  }}
                >
                  <SelectTrigger size="sm" className="w-[4.5rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              {totalPages > 1 ? (
                <Pagination className="mx-0 w-auto">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          setPage((current) => Math.max(1, current - 1));
                        }}
                        className={page === 1 ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                    {getPageNumbers(page, totalPages).map((p, index) =>
                      p === 'ellipsis' ? (
                        <PaginationItem key={`ellipsis-${index}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={p}>
                          <PaginationLink
                            href="#"
                            isActive={p === page}
                            onClick={(event) => {
                              event.preventDefault();
                              setPage(p);
                            }}
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      ),
                    )}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          setPage((current) => Math.min(totalPages, current + 1));
                        }}
                        className={page === totalPages ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              ) : null}
            </div>
          </>
        )}
      </Card>
    </>
  );
}
