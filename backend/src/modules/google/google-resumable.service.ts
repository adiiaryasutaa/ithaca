import type { GoogleAuthClient } from './google.service.js';

export async function initResumableSession(
  auth: GoogleAuthClient,
  params: { fileName: string; mimeType: string; sizeBytes: bigint; parentId: string },
) {
  const headers = new Headers();
  const token = await auth.getAccessToken();
  headers.set('Authorization', `Bearer ${token.token}`);
  headers.set('Content-Type', 'application/json');
  headers.set('X-Upload-Content-Type', params.mimeType);
  headers.set('X-Upload-Content-Length', params.sizeBytes.toString());

  const initRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: params.fileName, parents: [params.parentId] }),
    },
  );

  if (!initRes.ok) {
    const errText = await initRes.text();
    throw new Error(`Google API Init Error: ${errText}`);
  }

  const sessionUri = initRes.headers.get('location');
  if (!sessionUri) throw new Error('Google API did not return Location header.');
  return sessionUri;
}

export type ResumableStatusResult =
  | { status: 'completed' }
  | { status: 'uploading'; offset: bigint };

export async function queryResumableStatus(
  auth: GoogleAuthClient,
  sessionUri: string,
  totalSizeBytes: bigint,
): Promise<ResumableStatusResult> {
  const token = await auth.getAccessToken();
  const queryHeaders = new Headers();
  queryHeaders.set('Authorization', `Bearer ${token.token}`);
  queryHeaders.set('Content-Range', `bytes */${totalSizeBytes}`);

  const queryRes = await fetch(sessionUri, { method: 'PUT', headers: queryHeaders });

  if (queryRes.status === 308) {
    const range = queryRes.headers.get('range');
    if (range) {
      const parts = range.split('-');
      const lastByte = BigInt(parts[1]);
      return { status: 'uploading', offset: lastByte + 1n };
    }
  } else if (queryRes.ok) {
    return { status: 'completed' };
  }

  return { status: 'uploading', offset: 0n };
}

export type ResumableChunkResult =
  | { status: 'uploading'; offset: bigint }
  | { status: 'completed'; file: { id: string; name: string; mimeType: string } }
  | { status: 'failed'; httpStatus: number; message: string };

export async function putResumableChunk(
  auth: GoogleAuthClient,
  sessionUri: string,
  params: { rangeHeader: string; endByte: bigint; contentLength: bigint; body: unknown },
): Promise<ResumableChunkResult> {
  const token = await auth.getAccessToken();
  const putHeaders = new Headers();
  putHeaders.set('Authorization', `Bearer ${token.token}`);
  putHeaders.set('Content-Range', params.rangeHeader);
  putHeaders.set('Content-Length', params.contentLength.toString());

  const putRes = await fetch(sessionUri, {
    method: 'PUT',
    headers: putHeaders,
    body: params.body as any,
    duplex: 'half',
  } as any);

  if (putRes.status === 308) {
    return { status: 'uploading', offset: params.endByte + 1n };
  }

  if (putRes.ok) {
    const fileMeta = (await putRes.json()) as { id: string; name: string; mimeType: string };
    return { status: 'completed', file: fileMeta };
  }

  const message = await putRes.text();
  return { status: 'failed', httpStatus: putRes.status, message };
}
