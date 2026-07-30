import { Folder } from 'lucide-react';
import { cn } from '@/lib/utils';
import { defaultFolderIconUrl, iconUrlWithColor, normalizeFolderColor } from '@/lib/folder-visual';
import type { FolderItem } from '@/data/drive-data';

export function FolderVisual({
  folder,
  className,
  iconClassName,
}: {
  folder: Pick<FolderItem, 'color' | 'iconUrl'>;
  className?: string;
  iconClassName?: string;
}) {
  const color = normalizeFolderColor(folder.color);
  const iconUrl = folder.iconUrl || defaultFolderIconUrl;
  return (
    <span className={cn('inline-flex items-center justify-center', className)}>
      {iconUrl ? (
        <img
          src={iconUrlWithColor(iconUrl, color)}
          alt=""
          className={cn('h-full w-full object-contain', iconClassName)}
        />
      ) : (
        <Folder
          className={cn('h-full w-full fill-current stroke-current', iconClassName)}
          style={{ color }}
        />
      )}
    </span>
  );
}
