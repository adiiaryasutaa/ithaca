import type { ConnectedAccount, File } from '@prisma/client';
import type { Response } from 'express';
import { Readable } from 'node:stream';
import { fetchGoogleFileStream } from '../google/google.service.js';
import { fetchS3FileStream, streamS3File } from '../s3/s3.service.js';
import { streamGoogleFile } from './stream-google-file.js';

type FileWithAccount = File & { connectedAccount: ConnectedAccount };
type StreamOptions = { disposition?: 'inline' | 'attachment' };

export function streamProviderFile(
  file: FileWithAccount,
  range: string | undefined,
  res: Response,
  options: StreamOptions = {},
) {
  if (file.provider === 's3') return streamS3File(file, range, res, options);
  return streamGoogleFile(file, range, res, options);
}

/**
 * Pure (no Express Response coupling) provider-file fetch, used by batch-download's
 * zip archiving. Returns null when the Google fetch comes back non-ok — matches the
 * pre-refactor batch-download loop's silent-skip-without-logging behavior for that
 * case, as distinct from a thrown error (which callers should catch and log).
 */
export async function getProviderFileStream(
  file: FileWithAccount,
): Promise<{ stream: Readable; fileName: string; mimeType: string } | null> {
  if (file.provider === 's3') return fetchS3FileStream(file);
  const { response, fileName, mimeType } = await fetchGoogleFileStream(
    file.connectedAccount,
    file,
  );
  if (!response.ok || !response.body) return null;
  return { stream: Readable.fromWeb(response.body as any), fileName, mimeType };
}
