import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { logger } from '../config/logger.js';
import { HttpError } from '../utils/http-error.js';

export function errorMiddleware(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof HttpError) {
    logger.warn({ err: error }, error.message);
    return res.status(error.status).json({ code: error.code, message: error.message });
  }

  if (error instanceof ZodError) {
    logger.warn({ err: error }, 'Validation error');
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Invalid request payload.',
      issues: error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') {
      logger.warn({ err: error }, 'Resource not found');
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Resource not found.' });
    }
    if (error.code === 'P2002') {
      logger.warn({ err: error }, 'Resource conflict');
      return res.status(409).json({ code: 'CONFLICT', message: 'Resource already exists.' });
    }
  }

  logger.error({ err: error }, 'Unhandled error');
  const message = error instanceof Error ? error.message : 'Internal server error';
  return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message });
}
