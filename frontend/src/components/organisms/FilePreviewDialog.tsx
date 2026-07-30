import { useEffect, useRef } from 'react';
import { DummyModal } from '@/components/molecules/DummyModal';
import { createPlyr, ensurePlyr } from '@/lib/plyr';
import { getPreviewKind, officeViewerUrl } from '@/lib/preview';
import type { FileItem } from '@/data/drive-data';

export function FilePreviewDialog({
  open,
  file,
  url,
  loading,
  error,
  onError,
  onClose,
}: {
  open: boolean;
  file: FileItem | null;
  url: string;
  loading: boolean;
  error: string;
  onError: (message: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const kind = getPreviewKind(file?.mimeType);

  // Plyr is loaded on demand: it is only needed for video previews, and pulling it into the
  // main bundle would cost every page load.
  useEffect(() => {
    if (!open || !file?.mimeType?.startsWith('video/') || !videoRef.current) return undefined;
    let disposed = false;
    let player: { destroy: () => void } | null = null;

    ensurePlyr()
      .then(() => {
        if (disposed || !videoRef.current) return;
        player = createPlyr(videoRef.current);
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      player?.destroy();
    };
  }, [open, file?.mimeType, url]);

  const ready = !loading && !error && Boolean(url);

  return (
    <DummyModal
      open={open}
      title="File Preview"
      description={file?.name ?? ''}
      onClose={onClose}
      className="overflow-hidden sm:max-w-[95vw] xl:max-w-[1400px]"
    >
      <div className="flex h-[72dvh] w-full items-center justify-center overflow-hidden rounded-sm border border-border bg-muted sm:h-[80vh]">
        {loading ? (
          <div className="p-6 text-center text-sm font-semibold text-muted-foreground">
            Loading preview...
          </div>
        ) : null}
        {error ? <div className="p-6 text-center text-sm text-destructive">{error}</div> : null}
        {ready && kind === 'image' ? (
          <img
            src={url}
            alt={file?.name ?? 'File preview'}
            className="max-h-full max-w-full object-contain"
            onError={() => onError('Failed to load preview.')}
          />
        ) : null}
        {ready && kind === 'video' ? (
          <div className="shared-video-shell">
            <video
              ref={videoRef}
              controls
              playsInline
              preload="metadata"
              onError={() => onError('Failed to load preview.')}
            >
              <source src={url} type={file?.mimeType} />
            </video>
          </div>
        ) : null}
        {ready && kind === 'document' ? (
          <iframe
            src={url}
            title={file?.name ?? 'File preview'}
            className="h-full w-full border-0 bg-white"
          />
        ) : null}
        {ready && kind === 'office' ? (
          <iframe
            src={officeViewerUrl(url)}
            title={file?.name ?? 'File preview'}
            className="h-full w-full border-0 bg-white"
          />
        ) : null}
        {!loading && !error && !kind ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Preview not available for this file type. Use Download instead.
          </div>
        ) : null}
      </div>
    </DummyModal>
  );
}
