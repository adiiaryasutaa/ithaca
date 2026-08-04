import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import type { ConnectedAccount, File, S3StorageConfig } from '@prisma/client';
import type { Response } from 'express';
import type { Readable } from 'node:stream';
import { decryptText, encryptText, randomToken } from '../../utils/crypto.js';
import { applyStreamHeaders } from '../files/stream-headers.js';
import * as s3Repository from './s3.repository.js';

type S3Config = S3StorageConfig;
type FileWithAccount = File & { connectedAccount: ConnectedAccount };
type StreamOptions = { disposition?: 'inline' | 'attachment' };

export function createS3Client(config: S3Config) {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint ?? undefined,
    forcePathStyle: config.forcePathStyle || Boolean(config.endpoint),
    credentials: {
      accessKeyId: decryptText(config.accessKeyIdEncrypted),
      secretAccessKey: decryptText(config.secretAccessKeyEncrypted),
    },
  });
}

export async function getS3ConfigForAccount(accountId: string) {
  return s3Repository.findActiveS3ConfigForAccount(accountId);
}

export async function testS3Connection(config: S3Config) {
  const client = createS3Client(config);
  await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
}

function safeFileName(name: string) {
  return (
    name
      .replace(/[\\/]+/g, '-')
      .replace(/[\u0000-\u001f\u007f]+/g, '')
      .slice(0, 180) || 'file'
  );
}

export function buildS3ObjectKey(
  config: Pick<S3Config, 'prefix'>,
  fileId: string,
  fileName: string,
) {
  return `${config.prefix.replace(/^\/+|\/+$/g, '')}/${fileId}/${safeFileName(fileName)}`;
}

export async function uploadS3Object(
  config: S3Config,
  key: string,
  body: NodeJS.ReadableStream,
  mimeType: string,
) {
  const client = createS3Client(config);
  await new Upload({
    client,
    params: { Bucket: config.bucket, Key: key, Body: body as Readable, ContentType: mimeType },
  }).done();
}

export async function deleteS3Object(file: FileWithAccount) {
  const config = await getS3ConfigForAccount(file.connectedAccountId);
  const client = createS3Client(config);
  await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: file.providerFileId }));
}

export async function syncS3Quota(accountId: string) {
  const config = await getS3ConfigForAccount(accountId);
  const client = createS3Client(config);
  let usedBytes = 0n;
  let continuationToken: string | undefined;
  do {
    const response = await client.send(
      new ListObjectsV2Command({ Bucket: config.bucket, ContinuationToken: continuationToken }),
    );
    for (const object of response.Contents ?? []) usedBytes += BigInt(object.Size ?? 0);
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return s3Repository.upsertS3StorageAccountQuota(accountId, {
    totalBytes: config.quotaBytes,
    usedBytes,
    availableBytes: config.quotaBytes === null ? null : config.quotaBytes - usedBytes,
  });
}

export async function streamS3File(
  file: FileWithAccount,
  range: string | undefined,
  res: Response,
  options: StreamOptions = {},
) {
  const config = await getS3ConfigForAccount(file.connectedAccountId);
  const client = createS3Client(config);
  const response = await client.send(
    new GetObjectCommand({ Bucket: config.bucket, Key: file.providerFileId, Range: range }),
  );

  res.status(response.ContentRange ? 206 : 200);
  applyStreamHeaders(
    res,
    { mimeType: response.ContentType ?? file.mimeType, fileName: file.name },
    options.disposition,
  );
  if (response.ContentLength !== undefined)
    res.setHeader('Content-Length', response.ContentLength.toString());
  if (response.ContentRange) res.setHeader('Content-Range', response.ContentRange);

  const body = response.Body as Readable | undefined;
  if (!body) return res.end();
  return body.pipe(res);
}

export type ConnectS3AccountInput = {
  name: string;
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
  quotaBytes?: string | null;
};

/**
 * Connects (or reconnects) an S3-compatible bucket as a ConnectedAccount.
 * S3 accounts currently piggyback on an active Google providerConfig row
 * (pre-existing quirk, not something this refactor changes) and use
 * placeholder OAuth-shaped tokens since S3 auth is access-key based.
 * Rolls back (deletes) a newly-created account if the post-connect
 * test/quota-sync fails; never rolls back a pre-existing account.
 */
export async function connectS3Account(
  userId: string,
  input: ConnectS3AccountInput,
): Promise<{ account: ConnectedAccount; storageAccount: Awaited<ReturnType<typeof syncS3Quota>> }> {
  const providerConfig = await s3Repository.findActiveGoogleProviderConfig();
  const providerAccountId = `${input.bucket}:${input.endpoint || input.region}`;
  const existingAccount =
    await s3Repository.findS3ConnectedAccountByProviderAccountId(providerAccountId);

  const accountFields = {
    providerConfigId: providerConfig.id,
    email: `${input.bucket} (S3)`,
    displayName: input.name,
    accessTokenEncrypted: encryptText('s3'),
    refreshTokenEncrypted: encryptText(randomToken()),
    tokenExpiresAt: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000),
  };

  const account = existingAccount
    ? await s3Repository.updateS3ConnectedAccount(existingAccount.id, accountFields)
    : await s3Repository.createS3ConnectedAccount(userId, providerAccountId, accountFields);

  const config = await s3Repository.upsertS3StorageConfig(userId, account.id, {
    name: input.name,
    bucket: input.bucket,
    region: input.region,
    endpoint: input.endpoint || null,
    accessKeyIdEncrypted: encryptText(input.accessKeyId),
    secretAccessKeyEncrypted: encryptText(input.secretAccessKey),
    forcePathStyle: input.forcePathStyle ?? Boolean(input.endpoint),
    quotaBytes: input.quotaBytes ? BigInt(input.quotaBytes) : null,
  });

  try {
    await testS3Connection(config);
    const storageAccount = await syncS3Quota(account.id);
    return { account, storageAccount };
  } catch (error) {
    if (!existingAccount) await s3Repository.deleteConnectedAccount(account.id);
    throw error;
  }
}
