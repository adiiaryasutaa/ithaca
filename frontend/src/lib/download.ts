import { API_URL } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

/**
 * Downloads go through fetch + a blob URL rather than a plain <a href>, because the stream
 * endpoints need an Authorization header that a browser navigation cannot send.
 */
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

async function authedFetch(path: string, init?: RequestInit) {
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${getAccessToken()}` },
  });
}

export async function downloadFileById(fileId: string, fileName: string) {
  const response = await authedFetch(`/files/${fileId}/download`);
  if (!response.ok) throw new Error('Download failed');
  saveBlob(await response.blob(), fileName);
}

export async function downloadFilesAsZip(fileIds: string[], zipName = 'ithaca-download.zip') {
  const response = await authedFetch('/files/batch-download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileIds }),
  });
  if (!response.ok) throw new Error('Failed to download ZIP file');
  saveBlob(await response.blob(), zipName);
}
