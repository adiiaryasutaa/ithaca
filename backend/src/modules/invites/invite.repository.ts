import { prisma } from '../../config/prisma.js';

export function findUserEmailById(id: string) {
  return prisma.user.findUniqueOrThrow({ where: { id }, select: { email: true } });
}

export function findSentInvites() {
  return prisma.workspaceInvite.findMany({
    where: { revokedAt: null, targetId: { not: '' } },
    orderBy: { createdAt: 'desc' },
  });
}

export function findReceivedInvites(email: string) {
  return prisma.workspaceInvite.findMany({
    where: { inviteeEmail: email, revokedAt: null, targetId: { not: '' } },
    orderBy: { createdAt: 'desc' },
  });
}

export function findUsersByEmails(emails: string[]) {
  return prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, name: true, email: true },
  });
}

export function markInvitesAccepted(ids: string[]) {
  return prisma.workspaceInvite.updateMany({
    where: { id: { in: ids } },
    data: { status: 'accepted', acceptedAt: new Date() },
  });
}

export function findActiveFilesByIds(ids: string[]) {
  return prisma.file.findMany({
    where: { id: { in: ids }, status: 'active' },
    select: { id: true, name: true, mimeType: true, sizeBytes: true, folderId: true },
  });
}

export function findActiveFoldersByIds(ids: string[]) {
  return prisma.folder.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: { id: true, name: true },
  });
}

export function findActiveFileByIdOrThrow(id: string) {
  return prisma.file.findFirstOrThrow({ where: { id, status: 'active' } });
}

export function findActiveFolderByIdOrThrow(id: string) {
  return prisma.folder.findFirstOrThrow({ where: { id, deletedAt: null } });
}

export function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true },
  });
}

export function upsertInvite(params: {
  inviterId: string;
  inviteeEmail: string;
  role: string;
  targetType: string;
  targetId: string;
  status: string;
  acceptedAt: Date | null;
}) {
  return prisma.workspaceInvite.upsert({
    where: {
      inviterId_inviteeEmail_targetType_targetId: {
        inviterId: params.inviterId,
        inviteeEmail: params.inviteeEmail,
        targetType: params.targetType,
        targetId: params.targetId,
      },
    },
    create: {
      inviterId: params.inviterId,
      inviteeEmail: params.inviteeEmail,
      role: params.role,
      targetType: params.targetType,
      targetId: params.targetId,
      status: params.status,
      acceptedAt: params.acceptedAt,
    },
    update: {
      role: params.role,
      status: params.status,
      acceptedAt: params.acceptedAt,
      revokedAt: null,
    },
  });
}

export function revokeInviteById(id: string) {
  return prisma.workspaceInvite.updateMany({
    where: { id, revokedAt: null },
    data: { status: 'revoked', revokedAt: new Date() },
  });
}
