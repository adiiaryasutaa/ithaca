import type { NextFunction, Request, Response } from 'express';
import Busboy from 'busboy';
import { exec, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { logger } from '../../config/logger.js';
import * as systemService from './system.service.js';

export function triggerUpdate(req: Request, res: Response, _next: NextFunction) {
  const projectRoot = path.resolve(process.cwd(), '..');
  const updateScript = path.join(projectRoot, 'update.sh');

  // Check if git is installed
  exec('git --version', (gitError) => {
    if (gitError) {
      return res.status(400).json({
        code: 'GIT_NOT_FOUND',
        message:
          'Git is not installed inside the app container. Since you are running Ithaca in Docker, please update by running:\n\n1. ssh root@103.65.237.136\n2. cd ithaca\n3. git pull\n4. docker-compose down && docker-compose up -d --build\n\ndirectly in your VPS host terminal.',
      });
    }

    if (fs.existsSync(updateScript)) {
      try {
        // Clear old update log to prevent race conditions on frontend polling
        const logFile = path.join(projectRoot, 'update.log');
        fs.writeFileSync(logFile, 'Initiating update...\n');

        const child = spawn('bash', ['update.sh'], {
          cwd: projectRoot,
          detached: true,
          stdio: 'ignore',
        });
        child.unref();

        return res.json({
          status: 'success',
          message:
            'System update initiated. Rebuilding and restarting backend & frontend in the background. Please wait ~1 minute and refresh the page.',
        });
      } catch (err: any) {
        return res.status(500).json({
          code: 'UPDATE_FAILED',
          message: 'Failed to start update script.',
          error: err.message,
        });
      }
    } else {
      // Fallback to simple git pull if update.sh doesn't exist
      exec('git pull', { cwd: projectRoot }, (error, stdout, stderr) => {
        if (error) {
          logger.error({ err: error }, 'System update failed');
          return res.status(500).json({
            code: 'UPDATE_FAILED',
            message: 'Failed to run git pull. Make sure git is installed and configured.',
            error: error.message,
            stderr,
          });
        }

        logger.info({ stdout }, 'System update stdout');
        if (stderr) {
          logger.warn({ stderr }, 'System update stderr');
        }

        return res.json({
          status: 'success',
          message: 'System code updated successfully. Dev servers will auto-restart.',
          stdout,
          stderr,
        });
      });
    }
  });
}

export function getUpdateLog(_req: Request, res: Response) {
  const projectRoot = path.resolve(process.cwd(), '..');
  const logFile = path.join(projectRoot, 'update.log');

  if (!fs.existsSync(logFile)) {
    return res.json({
      log: 'No update history found.',
    });
  }

  try {
    const logContent = fs.readFileSync(logFile, 'utf8');
    return res.json({
      log: logContent,
    });
  } catch (error: any) {
    return res.status(500).json({
      code: 'READ_LOG_FAILED',
      message: 'Failed to read update log file.',
      error: error.message,
    });
  }
}

export async function getGoogleConfig(req: Request, res: Response) {
  const defaultRedirect = `${req.protocol}://${req.get('host')}/connected-accounts/google/callback`;
  const status = await systemService.getGoogleConfigStatus(defaultRedirect);
  return res.json(status);
}

export async function setGoogleConfig(req: Request, res: Response) {
  const defaultRedirect = `${req.protocol}://${req.get('host')}/connected-accounts/google/callback`;
  const id = await systemService.setGoogleConfig(req.body, defaultRedirect);
  return res.status(201).json({
    status: 'success',
    message: 'Global Google OAuth configuration updated successfully.',
    id,
  });
}

export function getBackup(_req: Request, res: Response, next: NextFunction) {
  try {
    if (!systemService.isSqliteMode()) {
      return res.status(501).json({
        code: 'NOT_SUPPORTED',
        message:
          "DB backup/restore only supports SQLite-mode deployments. This instance runs on Postgres/MySQL — use the provider's own backup tooling (e.g. Neon branch snapshots, mysqldump).",
      });
    }
    const dbPath = systemService.getDatabaseFilePath();
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Database file not found.' });
    }
    res.setHeader('Content-Disposition', 'attachment; filename=ithaca-backup.db');
    res.setHeader('Content-Type', 'application/octet-stream');
    const fileStream = fs.createReadStream(dbPath);
    fileStream.pipe(res);
  } catch (error) {
    return next(error);
  }
}

export function restoreBackup(req: Request, res: Response, next: NextFunction) {
  try {
    if (!systemService.isSqliteMode()) {
      return res.status(501).json({
        code: 'NOT_SUPPORTED',
        message:
          "DB backup/restore only supports SQLite-mode deployments. This instance runs on Postgres/MySQL — use the provider's own backup tooling (e.g. Neon branch snapshots, mysqldump).",
      });
    }
    const contentType = req.headers['content-type'];
    if (!contentType?.includes('multipart/form-data')) {
      return res
        .status(400)
        .json({ code: 'BAD_REQUEST', message: 'multipart/form-data required.' });
    }

    const busboy = Busboy({ headers: req.headers, limits: { files: 1 } });
    let fileReceived = false;

    busboy.on('file', (name, fileStream, info) => {
      fileReceived = true;
      const dbPath = systemService.getDatabaseFilePath();
      const tempDbPath = dbPath + '.tmp';
      const writeStream = fs.createWriteStream(tempDbPath);

      fileStream.pipe(writeStream);

      writeStream.on('finish', async () => {
        try {
          await systemService.restoreDatabaseFile(tempDbPath);

          res.json({
            status: 'success',
            message: 'Database restored successfully. Server will restart in 2 seconds.',
          });

          // Graceful exit after response is sent
          setTimeout(() => {
            logger.info('Database restored. Exiting to allow PM2 restart.');
            process.exit(0);
          }, 2000);
        } catch (err: any) {
          if (fs.existsSync(tempDbPath)) {
            try {
              fs.unlinkSync(tempDbPath);
            } catch {}
          }
          logger.error({ err }, 'Failed to restore database');
          return res.status(500).json({
            code: 'RESTORE_FAILED',
            message: 'Failed to restore database.',
            error: err.message,
          });
        }
      });

      writeStream.on('error', (err) => {
        if (fs.existsSync(tempDbPath)) {
          try {
            fs.unlinkSync(tempDbPath);
          } catch {}
        }
        logger.error({ err }, 'Write error on temp DB');
        return res.status(500).json({
          code: 'WRITE_ERROR',
          message: 'Failed to write temporary database file.',
          error: err.message,
        });
      });
    });

    busboy.on('error', (err) => {
      logger.error({ err }, 'Busboy error');
      if (!res.headersSent) {
        next(err);
      }
    });

    busboy.on('finish', () => {
      if (!fileReceived && !res.headersSent) {
        return res.status(400).json({ code: 'BAD_REQUEST', message: 'No file uploaded.' });
      }
    });

    req.pipe(busboy);
  } catch (error) {
    return next(error);
  }
}
