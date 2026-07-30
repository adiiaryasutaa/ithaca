import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DummyModal } from '@/components/molecules/DummyModal';
import type { FileItem } from '@/data/drive-data';

export function ShareLinkDialog({
  open,
  file,
  shareUrl,
  copied,
  gdrivePublicUrl,
  makingPublic,
  onCopy,
  onMakePublic,
  onClose,
}: {
  open: boolean;
  file: FileItem | null;
  shareUrl: string;
  copied: boolean;
  gdrivePublicUrl: string;
  makingPublic: boolean;
  onCopy: () => void;
  onMakePublic: () => void;
  onClose: () => void;
}) {
  return (
    <DummyModal open={open} title="Share Link" description={file?.name ?? ''} onClose={onClose}>
      <div className="grid gap-4">
        <div>
          <label className="text-xs font-bold text-muted-foreground block mb-1">
            Ithaca Public Share Link (No GDrive login required)
          </label>
          <Input value={shareUrl} readOnly />
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={onCopy}>
            {copied ? <CheckCircle className="h-4 w-4" /> : null}
            {copied ? 'Copied!' : 'Copy Link'}
          </Button>
        </div>

        {file?.accountProvider === 'google_drive' && (
          <div className="mt-4 pt-4 border-t border-border dark:border-slate-800 grid gap-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">
                Google Drive Direct Link (Public Access)
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                Configure this file to be publicly accessible on Google Drive so external tools can
                edit/download it.
              </p>
            </div>
            {gdrivePublicUrl ? (
              <div className="grid gap-2">
                <Input value={gdrivePublicUrl} readOnly />
              </div>
            ) : (
              <Button
                variant="outline"
                disabled={makingPublic}
                onClick={onMakePublic}
                className="w-full text-primary bg-primary/10 border-primary/20 dark:text-primary dark:bg-blue-950/30 dark:border-blue-900/50"
              >
                {makingPublic ? 'Making Public...' : 'Make Public & Copy GDrive Link'}
              </Button>
            )}
          </div>
        )}
      </div>
    </DummyModal>
  );
}
