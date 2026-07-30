import {
  Archive,
  CheckSquare,
  Download,
  FolderInput,
  FolderPlus,
  RefreshCw,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Three mutually exclusive states: files are selected (batch actions), select mode is on but
 * nothing is picked yet, or the default create/upload actions.
 */
export function FileToolbar({
  selectedCount,
  selectMode,
  syncing,
  onToggleSelectMode,
  onClearSelection,
  onDownloadZip,
  onMoveSelected,
  onDeleteSelected,
  onUpload,
  onNewFolder,
  onSync,
}: {
  selectedCount: number;
  selectMode: boolean;
  syncing: boolean;
  onToggleSelectMode: () => void;
  onClearSelection: () => void;
  onDownloadZip: () => void;
  onMoveSelected: () => void;
  onDeleteSelected: () => void;
  onUpload: () => void;
  onNewFolder: () => void;
  onSync: () => void;
}) {
  return (
    <div className="mt-4 flex flex-col gap-2 sm:mt-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="outline" className="hidden sm:inline-flex">
          <Archive className="h-4 w-4" />
          Recents
        </Button>
        <Button size="sm" variant="outline" className="hidden sm:inline-flex">
          <Star className="h-4 w-4" />
          Starred
        </Button>
      </div>
      {selectedCount > 0 ? (
        <div className="flex w-full flex-col gap-3 rounded-sm border border-orange-500/20 bg-orange-500/10 p-3 sm:w-auto sm:flex-row sm:items-center sm:border-0 sm:bg-transparent sm:p-0">
          <span className="text-sm font-extrabold text-foreground">{selectedCount} selected</span>
          <div className="grid grid-cols-4 gap-2 sm:flex sm:gap-3">
            <Button className="w-full sm:w-auto" variant="outline" onClick={onDownloadZip}>
              <Download className="h-4 w-4" />
              ZIP
            </Button>
            <Button className="w-full sm:w-auto" variant="outline" onClick={onMoveSelected}>
              <FolderInput className="h-4 w-4" />
              Move
            </Button>
            <Button className="w-full sm:w-auto" variant="destructive" onClick={onDeleteSelected}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
            <Button className="w-full sm:w-auto" variant="outline" onClick={onClearSelection}>
              Clear
            </Button>
          </div>
        </div>
      ) : selectMode ? (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Select files to continue</span>
          <Button size="sm" variant="outline" onClick={onToggleSelectMode}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={onToggleSelectMode}>
            <CheckSquare className="h-3.5 w-3.5" />
            Select
          </Button>
          <Button size="sm" onClick={onUpload}>
            <Upload className="h-3.5 w-3.5" />
            Upload
          </Button>
          <Button size="sm" variant="outline" onClick={onNewFolder}>
            <FolderPlus className="h-3.5 w-3.5" />
            New Folder
          </Button>
          <Button size="sm" variant="outline" disabled={syncing} onClick={onSync}>
            <RefreshCw className={syncing ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
            {syncing ? 'Syncing...' : 'Sync'}
          </Button>
        </div>
      )}
    </div>
  );
}
