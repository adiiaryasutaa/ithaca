import { API_URL } from '@/lib/api';

/**
 * Copy-paste examples shown on the API management page. They live here rather than in the
 * page so the exact request shape sits next to nothing else — if the public API changes,
 * this is the only file to touch.
 */
export const uploadCurlExample = `curl -X POST "${API_URL}/api/v1/uploads" \\
  -H "Authorization: Bearer 9d_live_xxx" \\
  -F 'filesMeta=[{"fieldName":"file-0","fileName":"hello.txt","mimeType":"text/plain","sizeBytes":"12"}]' \\
  -F "file-0=@hello.txt;type=text/plain"`;

export const uploadJsExample = `const form = new FormData()
form.append('filesMeta', JSON.stringify([
  { fieldName: 'file-0', fileName: file.name, mimeType: file.type, sizeBytes: String(file.size) },
]))
form.append('file-0', file)

await fetch('${API_URL}/api/v1/uploads', {
  method: 'POST',
  headers: { Authorization: 'Bearer 9d_live_xxx' },
  body: form,
})`;

export const listFilesCurlExample = `curl "${API_URL}/api/v1/files" \\
  -H "Authorization: Bearer 9d_live_xxx"`;

export const downloadFileCurlExample = `curl -OJ "${API_URL}/api/v1/files/<file-id>/download" \\
  -H "Authorization: Bearer 9d_live_xxx"`;
