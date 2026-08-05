import Busboy from 'busboy';
import type { NextFunction, Response } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';
import type { AuthRequest } from '../../middleware/auth.middleware.js';
import type { ApiKeyRequest } from '../../middleware/api-key.middleware.js';
import * as uploadService from './upload.service.js';

type UploadMeta = {
  fieldName: string;
  fileName: string;
  mimeType: string;
  sizeBytes: bigint;
  folderId?: string;
};
export type UploadRequest = AuthRequest & { apiKey?: ApiKeyRequest['apiKey'] };

export async function handleUpload(req: UploadRequest, res: Response, next: NextFunction) {
  try {
    uploadService.logUpload('request started', {
      userId: req.user!.id,
      contentLength: req.headers['content-length'],
    });
    const contentType = req.headers['content-type'];
    if (!contentType?.includes('multipart/form-data'))
      return res
        .status(400)
        .json({ code: 'UPLOAD_INVALID_CONTENT_TYPE', message: 'multipart/form-data required.' });

    const busboy = Busboy({
      headers: req.headers,
      limits: { files: 25, fileSize: env.MAX_UPLOAD_BYTES },
    });
    const pinnedFolderId = req.apiKey?.targetFolderId ?? null;
    const fields: { sizeBytes?: bigint; fileName?: string; mimeType?: string; folderId?: string } =
      {
        ...(pinnedFolderId ? { folderId: pinnedFolderId } : {}),
      };
    let batchMeta: UploadMeta[] | null = null;
    let responded = false;
    let fileSeen = false;
    const reservedBytesByAccount = new Map<string, bigint>();
    const completed: Array<Record<string, unknown>> = [];
    const failed: Array<{ fileName: string; code: string; message: string }> = [];
    const pendingUploads: Array<Promise<void>> = [];

    const fail = async (status: number, code: string, message: string) => {
      if (responded) return;
      responded = true;
      req.unpipe(busboy);
      req.resume();
      return res.status(status).json({ code, message });
    };

    const parseBatchMeta = (value: string) =>
      JSON.parse(value).map(
        (item: {
          fieldName: string;
          fileName: string;
          mimeType: string;
          sizeBytes: string | number;
          folderId?: string;
        }) => ({
          fieldName: item.fieldName,
          fileName: item.fileName,
          mimeType: item.mimeType,
          sizeBytes: BigInt(item.sizeBytes),
          folderId: item.folderId,
        }),
      ) as UploadMeta[];

    const metaForFile = (fieldName: string, info: { filename: string; mimeType: string }) => {
      if (batchMeta) return batchMeta.find((item) => item.fieldName === fieldName);
      const sizeBytes = fields.sizeBytes;
      if (!sizeBytes) return null;
      return {
        fieldName,
        sizeBytes,
        fileName: fields.fileName || info.filename,
        mimeType: fields.mimeType || info.mimeType || 'application/octet-stream',
        folderId: fields.folderId,
      };
    };

    const uploadOne = async (
      fieldName: string,
      fileStream: NodeJS.ReadableStream,
      info: { filename: string; mimeType: string },
    ) => {
      const meta = metaForFile(fieldName, info);
      const fileName = meta?.fileName || info.filename;
      try {
        fileStream.on('limit', () => uploadService.logUpload('file stream size limit reached', { fileName }));
        if (!meta?.sizeBytes || meta.sizeBytes <= 0n) {
          fileStream.resume();
          failed.push({
            fileName,
            code: 'UPLOAD_SIZE_REQUIRED',
            message: 'sizeBytes field must be sent before file field.',
          });
          return;
        }
        if (meta.sizeBytes > BigInt(env.MAX_UPLOAD_BYTES)) {
          fileStream.resume();
          failed.push({
            fileName,
            code: 'UPLOAD_TOO_LARGE',
            message: 'File exceeds max upload size.',
          });
          return;
        }

        const folderId = meta.folderId || null;

        const chunks: Buffer[] = [];
        fileStream.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        await new Promise<void>((resolve, reject) => {
          fileStream.on('end', resolve);
          fileStream.on('error', reject);
        });
        const fileBuffer = Buffer.concat(chunks);

        const result = await uploadService.uploadBufferedFile({
          userId: req.user!.id,
          fileName,
          mimeType: meta.mimeType,
          sizeBytes: meta.sizeBytes,
          folderId,
          fileBuffer,
          reservedBytesByAccount,
        });

        if (result.ok) {
          completed.push(result.file);
          return;
        }
        if (result.alsoCompletedFile) completed.push(result.alsoCompletedFile);
        failed.push({ fileName, code: result.code, message: result.message });
      } catch (error) {
        fileStream.resume();
        uploadService.logUpload('file upload failed', {
          fileName,
          message: error instanceof Error ? error.message : 'Upload failed',
        });
        failed.push({
          fileName,
          code: 'UPLOAD_FAILED',
          message: error instanceof Error ? error.message : 'Upload failed',
        });
      }
    };

    busboy.on('field', (name, value) => {
      if (name === 'sizeBytes') fields.sizeBytes = BigInt(value);
      if (name === 'fileName') fields.fileName = value;
      if (name === 'mimeType') fields.mimeType = value;
      if (name === 'folderId') {
        if (pinnedFolderId && value && value !== pinnedFolderId) {
          void fail(
            403,
            'API_KEY_FOLDER_MISMATCH',
            'This API key is pinned to a specific folder; folderId must match the pinned folder or be omitted.',
          );
          return;
        }
        fields.folderId = value || pinnedFolderId || undefined;
      }
      if (name === 'filesMeta') {
        const meta = parseBatchMeta(value);
        if (pinnedFolderId) {
          const mismatch = meta.some((item) => item.folderId && item.folderId !== pinnedFolderId);
          if (mismatch) {
            void fail(
              403,
              'API_KEY_FOLDER_MISMATCH',
              "This API key is pinned to a specific folder; each file's folderId must match the pinned folder or be omitted.",
            );
            return;
          }
          batchMeta = meta.map((item) => ({ ...item, folderId: item.folderId || pinnedFolderId }));
        } else {
          batchMeta = meta;
        }
      }
    });

    busboy.on('file', (name, fileStream, info) => {
      fileSeen = true;
      pendingUploads.push(uploadOne(name, fileStream, info));
    });

    busboy.on('error', (error) => {
      uploadService.logUpload('multipart parser failed', {
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      if (!responded) {
        responded = true;
        next(error);
      }
    });

    busboy.on('finish', () => {
      if (!responded && !fileSeen) return fail(400, 'UPLOAD_FILE_REQUIRED', 'file field required.');
      Promise.all(pendingUploads)
        .then(() => {
          if (responded) return;
          responded = true;
          uploadService.logUpload('response sent', { completed: completed.length, failed: failed.length });
          if (completed.length === 0)
            return res.status(400).json({
              code: failed[0]?.code ?? 'UPLOAD_FAILED',
              message: failed[0]?.message ?? 'Upload failed',
              failed,
            });
          if (!batchMeta && completed.length === 1 && failed.length === 0)
            return res.status(201).json({ file: completed[0] });
          return res.status(201).json({ files: completed, failed });
        })
        .catch(next);
    });

    req.pipe(busboy);
  } catch (error) {
    return next(error);
  }
}

const resumableInitSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.string(),
  folderId: z.string().nullable().optional(),
  targetAccountId: z.string().nullable().optional(),
});

export async function initResumable(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = resumableInitSchema.parse(req.body);
    const result = await uploadService.initResumableUpload({
      userId: req.user!.id,
      fileName: body.fileName,
      mimeType: body.mimeType,
      sizeBytes: BigInt(body.sizeBytes),
      folderId: body.folderId || null,
      targetAccountId: body.targetAccountId,
    });
    if (!result.ok) {
      return res.status(400).json({ code: result.code, message: result.message });
    }
    return res
      .status(201)
      .json({ sessionId: result.sessionId, provider: result.provider, offset: result.offset });
  } catch (error) {
    return next(error);
  }
}

export async function getResumableStatus(req: AuthRequest, res: Response) {
  try {
    const result = await uploadService.getResumableStatus(String(req.params.id));
    return res.json(result);
  } catch (error) {
    return res.json({ status: 'failed', offset: '0' });
  }
}

export async function putResumableChunk(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const rangeHeader = req.headers['content-range'];
    if (!rangeHeader || typeof rangeHeader !== 'string') {
      return res
        .status(400)
        .json({ code: 'MISSING_CONTENT_RANGE', message: 'Content-Range header is required.' });
    }

    const match = rangeHeader.match(/bytes\s+(\d+)-(\d+)\/(\d+)/);
    if (!match)
      return res
        .status(400)
        .json({ code: 'INVALID_CONTENT_RANGE', message: 'Invalid Content-Range format.' });

    const startByte = BigInt(match[1]);
    const endByte = BigInt(match[2]);

    const result = await uploadService.putResumableUploadChunk({
      userId: req.user!.id,
      sessionId: String(req.params.id),
      rangeHeader,
      startByte,
      endByte,
      requestBody: req,
    });

    if (result.kind === 'unsupported_provider') {
      return res.status(400).json({
        code: 'UNSUPPORTED_PROVIDER',
        message: 'Only Google Drive resumable uploads supported.',
      });
    }
    if (result.kind === 'uploading') {
      return res.json({ status: 'uploading', offset: result.offset });
    }
    if (result.kind === 'completed') {
      return res.status(201).json({ status: 'completed', file: result.file });
    }
    return res.status(result.httpStatus).json({ code: 'UPLOAD_FAILED', message: result.message });
  } catch (error) {
    return next(error);
  }
}
