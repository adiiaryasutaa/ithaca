import { useState } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import type { FolderItem } from '@/data/drive-data';

/**
 * Cut/paste for folders. "Cut" only parks the folder in state; the move happens on paste,
 * which reparents it to whatever folder the user is currently viewing.
 */
export function useFolderClipboard(onPasted: () => Promise<void> | void) {
  const [cutFolder, setCutFolder] = useState<FolderItem | null>(null);

  function cut(folder: FolderItem | null) {
    if (!folder?.id) return;
    setCutFolder(folder);
    toast.success(`Folder "${folder.name}" ready to move. Open target folder and press Ctrl+V.`);
  }

  async function paste(parentId: string | null) {
    if (!cutFolder?.id) return;
    await apiFetch(`/folders/${cutFolder.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ parentId }),
    });
    toast.success(`Folder "${cutFolder.name}" moved.`);
    setCutFolder(null);
    await onPasted();
  }

  return { cutFolder, cut, paste };
}
