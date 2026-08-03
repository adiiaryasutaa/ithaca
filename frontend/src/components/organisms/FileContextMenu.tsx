import {
  Copy,
  Download,
  Edit3,
  Eye,
  FolderInput,
  Info,
  Link2,
  Trash2,
  UserPlus,
} from 'lucide-react';
import type { FileItem } from '@/data/drive-data';

type Props = {
  x: number;
  y: number;
  file: FileItem | null;
  onClose: () => void;
  onView: () => void;
  onDownload: () => void;
  onRename: () => void;
  onMove: () => void;
  onDetails: () => void;
  onShare: () => void;
  onCopyLink: () => void;
  onInvite: () => void;
  onDelete: () => void;
};

const kindColors: Record<string, string> = {
  image: 'bg-emerald-500',
  video: 'bg-violet-500',
  pdf: 'bg-red-500',
  doc: 'bg-primary',
};

const kindLabels: Record<string, string> = {
  image: 'Image',
  video: 'Video',
  pdf: 'PDF',
  doc: 'Document',
};

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger = false,
  kbd,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  danger?: boolean;
  kbd?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'group relative flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-[13px] font-semibold transition-all duration-150',
        danger ? 'text-red-500 dark:text-red-400' : 'text-foreground dark:text-slate-200',
      ].join(' ')}
    >
      <span
        className={[
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-sm transition-all duration-150',
          danger
            ? 'bg-destructive/10 text-red-500 dark:bg-red-950/30 dark:text-red-400'
            : 'bg-muted text-muted-foreground dark:bg-slate-800 dark:text-muted-foreground',
        ].join(' ')}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="flex-1 text-left">{label}</span>
      {kbd && (
        <kbd className="hidden rounded-sm border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground group-hover:border-input dark:border-slate-700 dark:bg-slate-800 dark:text-muted-foreground sm:inline">
          {kbd}
        </kbd>
      )}
    </button>
  );
}

export function FileContextMenu({
  x,
  y,
  file,
  onClose,
  onView,
  onDownload,
  onRename,
  onMove,
  onDetails,
  onShare,
  onCopyLink,
  onInvite,
  onDelete,
}: Props) {
  if (!file) return null;

  const safeX = Math.max(12, Math.min(x, window.innerWidth - 228));
  const safeY = Math.max(12, Math.min(y, window.innerHeight - 430));
  const kindColor = kindColors[file.kind] ?? 'bg-slate-500';
  const kindLabel = kindLabels[file.kind] ?? 'File';

  function handleShare() {
    onShare();
  }

  function handleCopyLink() {
    onCopyLink();
  }

  return (
    <>
      <button
        className="fixed inset-0 z-40 cursor-default"
        aria-label="Close file menu"
        onClick={onClose}
      />
      <div
        className="fixed z-50 w-56 overflow-hidden rounded-sm border border-border bg-card shadow-2xl shadow-slate-950/15 dark:border-slate-800 dark:bg-slate-900"
        style={
          window.innerWidth >= 640
            ? { left: safeX, top: safeY }
            : { insetInline: '0.75rem', bottom: '0.75rem', position: 'fixed' }
        }
      >
        {/* Header: file name + kind badge + folder path */}
        <div className="border-b border-border bg-muted px-3.5 py-3 dark:border-slate-800 dark:bg-slate-800">
          <div className="flex items-start gap-2.5">
            <span
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-[10px] font-black text-white ${kindColor}`}
            >
              {kindLabel.slice(0, 3).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold leading-tight text-foreground dark:text-slate-100">
                {file.name}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <span className="rounded-sm bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground dark:bg-slate-700 dark:text-muted-foreground">
                  {file.size}
                </span>
                {file.folderName && (
                  <span className="flex items-center gap-0.5 rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary dark:bg-blue-950/40 dark:text-primary">
                    <FolderInput className="h-2.5 w-2.5" />
                    {file.folderName}
                  </span>
                )}
                {!file.folderName && (
                  <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground dark:bg-slate-800 dark:text-muted-foreground">
                    / All Files
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-1.5">
          <MenuItem icon={Eye} label="Preview" onClick={onView} kbd="↵" />
          <MenuItem icon={Download} label="Download" onClick={onDownload} />
          <MenuItem icon={Edit3} label="Rename" onClick={onRename} />
          <MenuItem icon={FolderInput} label="Move to Folder" onClick={onMove} />
          <MenuItem icon={Info} label="Details" onClick={onDetails} />

          <div className="my-1 h-px bg-muted dark:bg-slate-800" />

          <MenuItem icon={Link2} label="Share Link" onClick={handleShare} />
          <MenuItem icon={Copy} label="Copy Link" onClick={handleCopyLink} kbd="Ctrl+L" />
          <MenuItem icon={UserPlus} label="Invite Member" onClick={onInvite} />

          <div className="my-1 h-px bg-muted dark:bg-slate-800" />

          <MenuItem icon={Trash2} label="Delete" onClick={onDelete} danger />
        </div>
      </div>
    </>
  );
}
