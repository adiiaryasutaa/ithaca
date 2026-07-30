import { Download, History, Move, Plus, RefreshCw, Trash2, type LucideIcon } from 'lucide-react';
import { formatBytes } from '@/lib/api';

export type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: string | any | null;
  actorEmail: string | null;
  createdAt: string;
};

/**
 * Actions are free-form strings written by whichever route logged them, so they are matched
 * by substring rather than against a fixed list — an unrecognized action still renders.
 */
export function getActionBadge(action: string): { color: string; icon: LucideIcon } {
  const act = action.toUpperCase();
  if (act.includes('CREATE') || act.includes('UPLOAD'))
    return { color: 'bg-emerald-500/10 text-emerald-600', icon: Plus };
  if (act.includes('DELETE') || act.includes('PERMANENT') || act.includes('TRASH'))
    return { color: 'bg-rose-500/10 text-rose-600', icon: Trash2 };
  if (act.includes('RESTORE') || act.includes('SYNC'))
    return { color: 'bg-amber-500/10 text-amber-600', icon: RefreshCw };
  if (act.includes('MOVE')) return { color: 'bg-indigo-500/10 text-indigo-600', icon: Move };
  if (act.includes('DOWNLOAD')) return { color: 'bg-primary/10 text-primary', icon: Download };
  return { color: 'bg-foreground/10 text-muted-foreground', icon: History };
}

/**
 * `metadata` is whatever the logging call site passed — sometimes a JSON string, sometimes
 * an object, sometimes absent. Falls back to the entity type when there is nothing better.
 */
export function describeLog(log: AuditLog): { title: string; subtitle: string | null } {
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
