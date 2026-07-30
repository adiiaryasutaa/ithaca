import type { FolderItem } from '@/data/drive-data';

export function FolderBreadcrumbs({
  path,
  rootLabel = 'All Files',
  onRootClick,
  onFolderClick,
}: {
  path: FolderItem[];
  rootLabel?: string;
  onRootClick: () => void;
  onFolderClick: (folderId: string) => void;
}) {
  if (path.length === 0) return <>{rootLabel}</>;
  return (
    <span className="block min-w-0 truncate">
      <button className="text-primary hover:underline" onClick={onRootClick}>
        {rootLabel}
      </button>
      {path.map((folder, index) => (
        <span key={folder.id}>
          <span className="text-muted-foreground"> / </span>
          {index === path.length - 1 ? (
            <span>{folder.name}</span>
          ) : (
            <button
              className="text-primary hover:underline"
              onClick={() => folder.id && onFolderClick(folder.id)}
            >
              {folder.name}
            </button>
          )}
        </span>
      ))}
    </span>
  );
}
