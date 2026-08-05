import fs from 'fs';
import path from 'path';
import { decryptText, encryptText } from '../../utils/crypto.js';
import { HttpError } from '../../utils/http-error.js';
import * as systemRepository from './system.repository.js';

export function isSqliteMode(): boolean {
  const dbUrl = process.env.DATABASE_URL || '';
  return dbUrl.startsWith('sqlite:') || dbUrl.startsWith('file:');
}

export function getDatabaseFilePath(): string {
  const dbUrl = process.env.DATABASE_URL || 'file:./dev.db';
  let cleanPath = dbUrl.replace(/^(sqlite|file):/, '');

  if (cleanPath.includes('?')) {
    cleanPath = cleanPath.split('?')[0];
  }

  if (!path.isAbsolute(cleanPath)) {
    let baseDir = path.resolve(process.cwd(), 'prisma');
    if (!fs.existsSync(baseDir)) {
      baseDir = path.resolve(process.cwd(), 'backend', 'prisma');
    }
    if (!fs.existsSync(baseDir)) {
      baseDir = path.resolve(process.cwd(), '..', 'backend', 'prisma');
    }
    return path.resolve(baseDir, cleanPath);
  }

  return cleanPath;
}

export async function getGoogleConfigStatus(defaultRedirect: string) {
  const config = await systemRepository.findActiveGlobalGoogleConfig();

  if (!config) {
    return { exists: false, defaultRedirectUri: defaultRedirect };
  }

  let clientId = '';
  try {
    clientId = decryptText(config.clientIdEncrypted);
  } catch {
    clientId = '';
  }

  return {
    exists: true,
    clientId,
    redirectUri: config.redirectUri,
    hasSecret: !!config.clientSecretEncrypted,
    defaultRedirectUri: defaultRedirect,
  };
}

export async function setGoogleConfig(
  body: { clientId?: string; clientSecret?: string; redirectUri?: string },
  defaultRedirect: string,
) {
  const { clientId, clientSecret, redirectUri } = body;

  if (!clientId) {
    throw new HttpError(400, 'BAD_REQUEST', 'Client ID is required.');
  }

  const finalRedirectUri = redirectUri || defaultRedirect;

  const scopes = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ];

  // Disable old global active config
  await systemRepository.disableActiveGlobalGoogleConfigs();

  // Retrieve the old config to see if we need to reuse the secret if it was not provided in the request
  let finalSecret = clientSecret;
  if (!finalSecret) {
    const oldConfig = await systemRepository.findDisabledGlobalGoogleConfig();
    if (oldConfig) {
      try {
        finalSecret = decryptText(oldConfig.clientSecretEncrypted);
      } catch {
        // ignore
      }
    }
  }

  if (!finalSecret) {
    throw new HttpError(400, 'BAD_REQUEST', 'Client Secret is required for first-time setup.');
  }

  const config = await systemRepository.createGlobalGoogleConfig({
    clientIdEncrypted: encryptText(clientId),
    clientSecretEncrypted: encryptText(finalSecret),
    redirectUri: finalRedirectUri,
    scopes,
  });

  return config.id;
}

export async function restoreDatabaseFile(tempDbPath: string) {
  const dbPath = getDatabaseFilePath();
  // Disconnect prisma client first to release database lock
  await systemRepository.disconnectPrisma();
  // Replace old database file with restored database file
  fs.renameSync(tempDbPath, dbPath);
}
