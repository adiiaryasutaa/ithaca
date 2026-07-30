import { useState } from 'react';
import { API_URL, apiFetch } from '@/lib/api';
import type { FileItem } from '@/data/drive-data';

/**
 * Preview URLs are minted per file: the backend hands back a short-lived tokenized path so
 * the <img>/<video>/<iframe> can load it without an Authorization header.
 */
export function useFilePreview() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function preview(file: FileItem | null) {
    if (!file?.id) return;
    setUrl('');
    setError('');
    setLoading(true);
    setOpen(true);
    try {
      const data = await apiFetch<{ path?: string; url: string }>(
        `/files/${file.id}/preview-token`,
        { method: 'POST' },
      );
      setUrl(`${API_URL}${data.path ?? new URL(data.url).pathname}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preview');
    } finally {
      setLoading(false);
    }
  }

  function close() {
    setUrl('');
    setError('');
    setLoading(false);
    setOpen(false);
  }

  return { open, url, error, loading, setError, preview, close };
}
