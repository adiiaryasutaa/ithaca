import { prisma } from '../config/prisma.js';
import { logger } from '../config/logger.js';

export async function createAuditLog(
  userId: string,
  action: string,
  entityType: string,
  entityId?: string,
  metadata?: any,
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to create audit log');
  }
}
