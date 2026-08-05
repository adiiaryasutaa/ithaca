import * as auditLogRepository from './audit-log.repository.js';

export async function listRecentAuditLogs() {
  const logs = await auditLogRepository.findRecentAuditLogs();
  return logs.map(({ user, ...log }) => ({ ...log, actorEmail: user?.email ?? null }));
}
