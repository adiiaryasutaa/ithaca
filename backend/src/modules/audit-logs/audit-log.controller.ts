import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.middleware.js';
import * as auditLogService from './audit-log.service.js';

export async function list(_req: AuthRequest, res: Response) {
  const logs = await auditLogService.listRecentAuditLogs();
  return res.json({ logs });
}
