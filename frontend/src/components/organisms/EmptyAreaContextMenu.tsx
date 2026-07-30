import { ClipboardPaste, FolderPlus, Upload } from 'lucide-react';

type Props = {
  x: number;
  y: number;
  open: boolean;
  canPasteFolder?: boolean;
  onClose: () => void;
  onUpload: () => void;
  onCreateFolder: () => void;
  onPasteFolder?: () => void;
};

function MenuItem({
  icon: Icon,
  label,
  onClick,
  accent = false,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'group flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-[13px] font-semibold transition-all duration-150',
        accent ? 'text-primary dark:text-primary' : 'text-foreground dark:text-slate-200',
      ].join(' ')}
    >
      <span
        className={[
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-sm transition-all duration-150',
          accent
            ? 'bg-primary/10 text-blue-500 dark:bg-blue-950/30'
            : 'bg-muted text-muted-foreground dark:bg-slate-800 dark:text-muted-foreground',
        ].join(' ')}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="flex-1 text-left">{label}</span>
    </button>
  );
}

export function EmptyAreaContextMenu({
  x,
  y,
  open,
  canPasteFolder = false,
  onClose,
  onUpload,
  onCreateFolder,
  onPasteFolder,
}: Props) {
  if (!open) return null;
  const safeX = Math.max(12, Math.min(x, window.innerWidth - 228));
  const safeY = Math.max(12, Math.min(y, window.innerHeight - 160));

  return (
    <>
      <button
        className="fixed inset-0 z-40 cursor-default"
        aria-label="Close empty area menu"
        onClick={onClose}
      />
      <div
        className="fixed z-50 w-52 overflow-hidden rounded-sm border border-border bg-card shadow-2xl shadow-slate-950/15 dark:border-slate-800 dark:bg-slate-900"
        style={
          window.innerWidth >= 640
            ? { left: safeX, top: safeY }
            : { insetInline: '0.75rem', bottom: '0.75rem', position: 'fixed' }
        }
      >
        <div className="p-1.5">
          <MenuItem icon={Upload} label="Upload File" onClick={onUpload} accent />
          <MenuItem icon={FolderPlus} label="New Folder" onClick={onCreateFolder} />
          {canPasteFolder && onPasteFolder ? (
            <>
              <div className="my-1 h-px bg-muted dark:bg-slate-800" />
              <MenuItem icon={ClipboardPaste} label="Paste Folder Here" onClick={onPasteFolder} />
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
