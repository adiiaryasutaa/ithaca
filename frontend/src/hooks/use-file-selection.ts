import { useState } from 'react';
import type { FileItem } from '@/data/drive-data';

/** Multi-select state for a file list: which ids are picked, and whether picking is active. */
export function useFileSelection(visibleFiles: FileItem[]) {
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  function toggleFile(file: FileItem) {
    if (!file.id) return;
    setSelectedFileIds((current) => {
      const next = new Set(current);
      if (next.has(file.id!)) next.delete(file.id!);
      else next.add(file.id!);
      return next;
    });
  }

  function toggleAllVisible() {
    const visibleIds = visibleFiles.map((file) => file.id).filter(Boolean) as string[];
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedFileIds.has(id));
    setSelectedFileIds(allSelected ? new Set() : new Set(visibleIds));
  }

  function clear() {
    setSelectedFileIds(new Set());
    setSelectMode(false);
  }

  function toggleSelectMode() {
    setSelectMode((current) => !current);
    setSelectedFileIds(new Set());
  }

  return {
    selectedFileIds,
    setSelectedFileIds,
    selectMode,
    allVisibleSelected:
      visibleFiles.length > 0 &&
      visibleFiles.every((file) => file.id && selectedFileIds.has(file.id)),
    toggleFile,
    toggleAllVisible,
    clear,
    toggleSelectMode,
  };
}
