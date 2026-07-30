import { MoreVertical, Star } from 'lucide-react';
import { type DragEvent, type MouseEvent, useState } from 'react';
import { FileIcon } from '@/components/atoms/FileIcon';
import { FolderVisual } from '@/components/atoms/FolderVisual';
import type { FileItem, FolderItem } from '@/data/drive-data';
import { apiFetch } from '@/lib/api';

export function FileTable({
  files,
  folders = [],
  mode = 'default',
  selectable = true,
  selectedFileIds = new Set<string>(),
  allSelected = false,
  onFileContextMenu,
  onToggleFile,
  onToggleAll,
  onFolderOpen,
  onFolderMenu,
  onDropOnFolder,
}: {
  files: FileItem[];
  folders?: FolderItem[];
  mode?: 'default' | 'shared' | 'recent' | 'starred' | 'archived';
  selectable?: boolean;
  selectedFileIds?: Set<string>;
  allSelected?: boolean;
  onFileContextMenu?: (event: MouseEvent<HTMLElement>, file: FileItem) => void;
  onToggleFile?: (file: FileItem) => void;
  onToggleAll?: () => void;
  onFolderOpen?: (folder: FolderItem) => void;
  onFolderMenu?: (event: MouseEvent<HTMLElement>, folder: FolderItem) => void;
  onDropOnFolder?: (fileId: string, folderId: string) => void;
}) {
  const [copiedFileId, setCopiedFileId] = useState<string | null>(null);

  function handleFolderDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }

  function handleFolderDragEnter(event: DragEvent<HTMLElement>) {
    event.currentTarget.classList.add('bg-primary/10', 'border-primary');
  }

  function handleFolderDragLeave(event: DragEvent<HTMLElement>) {
    event.currentTarget.classList.remove('bg-primary/10', 'border-primary');
  }

  function handleFolderDrop(event: DragEvent<HTMLElement>, folder: FolderItem) {
    event.preventDefault();
    event.currentTarget.classList.remove('bg-primary/10', 'border-primary');
    const fileId = event.dataTransfer.getData('text/plain');
    if (fileId && folder.id) onDropOnFolder?.(fileId, folder.id);
  }

  return (
    <div>
      {/* Mobile card view */}
      <div className="grid gap-2.5 p-3 sm:hidden">
        {selectable && onToggleAll ? (
          <label className="flex items-center justify-between rounded-sm border border-border bg-card px-4 py-3 text-sm font-bold shadow-sm">
            <span>Select all files</span>
            <input
              type="checkbox"
              className="h-5 w-5 accent-blue-600"
              checked={allSelected}
              onChange={onToggleAll}
            />
          </label>
        ) : null}
        {folders.map((folder) => (
          <article
            key={folder.id ?? folder.name}
            onClick={() => onFolderOpen?.(folder)}
            onContextMenu={(event) => onFolderMenu?.(event, folder)}
            onDragOver={handleFolderDragOver}
            onDragEnter={handleFolderDragEnter}
            onDragLeave={handleFolderDragLeave}
            onDrop={(event) => handleFolderDrop(event, folder)}
            className="overflow-hidden rounded-sm border border-border bg-card p-3.5 shadow-sm cursor-pointer transition"
          >
            <div className="flex items-center gap-3">
              <div className="shrink-0">
                <FolderVisual folder={folder} className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <h3
                  className="truncate text-sm font-bold leading-snug text-foreground"
                  title={folder.name}
                >
                  {folder.name}
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{folder.updated}</span>
                </div>
              </div>
              <button
                className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-muted-foreground"
                onClick={(event) => {
                  event.stopPropagation();
                  onFolderMenu?.(event, folder);
                }}
                aria-label={`Open ${folder.name} menu`}
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </div>
          </article>
        ))}
        {files.map((file) => {
          const selected = selectedFileIds.has(file.id ?? '');
          const meta =
            mode === 'archived'
              ? file.location
              : mode === 'recent'
                ? file.openedDate
                : mode === 'starred'
                  ? file.starredDate
                  : file.date;
          return (
            <article
              key={file.id ?? file.name}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData('text/plain', file.id ?? '');
                event.dataTransfer.effectAllowed = 'move';
              }}
              onClick={() => onToggleFile?.(file)}
              onContextMenu={(event) => onFileContextMenu?.(event, file)}
              className={
                selected
                  ? 'overflow-hidden rounded-sm border file-selected p-3.5 shadow-sm cursor-grab active:cursor-grabbing'
                  : 'overflow-hidden rounded-sm border border-border bg-card p-3.5 shadow-sm cursor-grab active:cursor-grabbing'
              }
            >
              <div className="flex items-center gap-3">
                {selectable && onToggleFile ? (
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 accent-blue-600"
                    checked={selected}
                    onChange={() => onToggleFile?.(file)}
                    onClick={(event) => event.stopPropagation()}
                  />
                ) : null}
                <div className="shrink-0">
                  {mode === 'starred' ? (
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ) : (
                    <FileIcon kind={file.kind} />
                  )}
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <h3
                    className="truncate text-sm font-bold leading-snug text-foreground"
                    title={file.name}
                  >
                    {file.name}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{meta}</span>
                    <span>·</span>
                    <span>{file.size}</span>
                  </div>
                </div>
                <button
                  className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-muted-foreground"
                  onClick={(event) => {
                    event.stopPropagation();
                    onFileContextMenu?.(event, file);
                  }}
                  aria-label={`Open ${file.name} menu`}
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* Desktop table view */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[860px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase text-muted-foreground">
              {selectable ? (
                <th className="w-9 px-4 py-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-blue-600"
                    checked={allSelected}
                    onChange={onToggleAll}
                  />
                </th>
              ) : null}
              <th className="px-4 py-3 font-semibold whitespace-nowrap">Name</th>
              {mode === 'shared' ? (
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Owner</th>
              ) : null}
              {mode === 'recent' ? (
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Last Opened</th>
              ) : null}
              {mode === 'starred' ? (
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Starred On</th>
              ) : null}
              {mode === 'archived' ? (
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Archived Date</th>
              ) : null}
              {mode === 'archived' ? (
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Original Location</th>
              ) : (
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Last Modified</th>
              )}
              <th className="px-4 py-3 font-semibold whitespace-nowrap">Size</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {folders.map((folder) => (
              <tr
                key={folder.id ?? folder.name}
                onContextMenu={(event) => onFolderMenu?.(event, folder)}
                onClick={() => onFolderOpen?.(folder)}
                onDragOver={handleFolderDragOver}
                onDragEnter={handleFolderDragEnter}
                onDragLeave={handleFolderDragLeave}
                onDrop={(event) => handleFolderDrop(event, folder)}
                className="group border-b border-border transition cursor-pointer last:border-0"
              >
                {selectable ? <td className="px-4 py-3" /> : null}
                <td className="px-4 py-3 font-semibold text-foreground">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <FolderVisual folder={folder} className="h-4 w-4 shrink-0" />
                    <span className="truncate max-w-[200px] lg:max-w-[280px]" title={folder.name}>
                      {folder.name}
                    </span>
                  </span>
                </td>
                {mode === 'shared' ? <td className="px-4 py-3 text-muted-foreground">—</td> : null}
                {mode === 'recent' ? <td className="px-4 py-3 text-muted-foreground">—</td> : null}
                {mode === 'starred' ? <td className="px-4 py-3 text-muted-foreground">—</td> : null}
                {mode === 'archived' ? (
                  <td className="px-4 py-3 text-muted-foreground">—</td>
                ) : null}
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                  {folder.updated}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">—</td>
                <td className="px-4 py-3 text-right">
                  <button
                    className="ml-auto flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground shrink-0"
                    onClick={(event) => {
                      event.stopPropagation();
                      onFolderMenu?.(event, folder);
                    }}
                    aria-label={`Open ${folder.name} menu`}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {files.map((file) => (
              <tr
                key={file.id ?? file.name}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/plain', file.id ?? '');
                  event.dataTransfer.effectAllowed = 'move';
                }}
                onContextMenu={(event) => onFileContextMenu?.(event, file)}
                onClick={() => onToggleFile?.(file)}
                className={
                  selectedFileIds.has(file.id ?? '')
                    ? 'group border-b file-selected transition cursor-grab last:border-0 active:cursor-grabbing'
                    : 'group border-b border-border transition cursor-grab last:border-0 active:cursor-grabbing'
                }
              >
                {selectable ? (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-blue-600"
                      checked={selectedFileIds.has(file.id ?? '')}
                      onChange={() => onToggleFile?.(file)}
                      onClick={(event) => event.stopPropagation()}
                    />
                  </td>
                ) : null}
                <td className="px-4 py-3 font-semibold text-foreground">
                  <span className="flex min-w-0 items-center gap-2.5">
                    {mode === 'starred' ? (
                      <Star className="h-4 w-4 shrink-0 fill-yellow-400 text-yellow-400" />
                    ) : (
                      <FileIcon kind={file.kind} />
                    )}
                    <span className="truncate max-w-[200px] lg:max-w-[280px]" title={file.name}>
                      {file.name}
                    </span>
                  </span>
                </td>
                {mode === 'shared' ? (
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {file.owner}
                  </td>
                ) : null}
                {mode === 'recent' ? (
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {file.openedDate}
                  </td>
                ) : null}
                {mode === 'starred' ? (
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {file.starredDate}
                  </td>
                ) : null}
                {mode === 'archived' ? (
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {file.archivedDate}
                  </td>
                ) : null}
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                  {mode === 'archived' ? file.location : file.date}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{file.size}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {/* Hover shortcuts */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex gap-1.5">
                      <button
                        title="Copy Link"
                        onClick={async (event) => {
                          event.stopPropagation();
                          try {
                            const data = await apiFetch<{ url: string | null }>(
                              `/files/${file.id}/view-url`,
                            );
                            if (data.url) {
                              await navigator.clipboard.writeText(data.url);
                              setCopiedFileId(file.id ?? null);
                              setTimeout(() => setCopiedFileId(null), 2000);
                            } else {
                              const shareData = await apiFetch<{ url: string }>(
                                `/files/${file.id}/share`,
                                { method: 'POST' },
                              );
                              await navigator.clipboard.writeText(shareData.url);
                              setCopiedFileId(file.id ?? null);
                              setTimeout(() => setCopiedFileId(null), 2000);
                            }
                          } catch {
                            /* ignore */
                          }
                        }}
                        className={
                          copiedFileId === file.id
                            ? 'inline-flex h-7 px-2 items-center justify-center rounded-sm text-[11px] font-bold text-emerald-600 bg-emerald-500/10 transition-all scale-95'
                            : 'inline-flex h-7 px-2 items-center justify-center rounded-sm text-[11px] font-bold text-primary bg-primary/10 transition-colors'
                        }
                      >
                        {copiedFileId === file.id ? 'Copied!' : 'Copy Link'}
                      </button>
                      <button
                        title="Move File"
                        onClick={(event) => {
                          event.stopPropagation();
                          window.dispatchEvent(
                            new CustomEvent('ithaca:open-move-modal', { detail: file }),
                          );
                        }}
                        className="inline-flex h-7 px-2 items-center justify-center rounded-sm text-[11px] font-bold text-muted-foreground bg-muted transition-colors"
                      >
                        Move
                      </button>
                    </div>
                    <button
                      className="flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground shrink-0"
                      onClick={(event) => {
                        event.stopPropagation();
                        onFileContextMenu?.(event, file);
                      }}
                      aria-label={`Open ${file.name} menu`}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
