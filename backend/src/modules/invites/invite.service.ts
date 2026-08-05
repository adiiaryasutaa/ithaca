import { normalizeEmail } from '../../utils/email.js';
import { HttpError } from '../../utils/http-error.js';
import * as inviteRepository from './invite.repository.js';

type InviteRecord = {
  id: string;
  inviterId: string;
  inviteeEmail: string;
  targetType: string;
  targetId: string;
  role: string;
  status: string;
  revokedAt: Date | null;
  acceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
type TargetRecord = {
  id: string;
  name: string;
  type: 'file' | 'folder';
  mimeType?: string;
  sizeBytes?: string;
  folderId?: string | null;
};

async function assertTargetExists(targetType: string, targetId: string) {
  if (targetType === 'file') return inviteRepository.findActiveFileByIdOrThrow(targetId);
  return inviteRepository.findActiveFolderByIdOrThrow(targetId);
}

async function resolveTargets(invites: InviteRecord[]) {
  const fileIds = invites
    .filter((invite) => invite.targetType === 'file')
    .map((invite) => invite.targetId);
  const folderIds = invites
    .filter((invite) => invite.targetType === 'folder')
    .map((invite) => invite.targetId);
  const [files, folders] = await Promise.all([
    inviteRepository.findActiveFilesByIds(fileIds),
    inviteRepository.findActiveFoldersByIds(folderIds),
  ]);
  const targets = new Map<string, TargetRecord>();
  for (const file of files)
    targets.set(`file:${file.id}`, {
      id: file.id,
      name: file.name,
      type: 'file',
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes.toString(),
      folderId: file.folderId,
    });
  for (const folder of folders)
    targets.set(`folder:${folder.id}`, { id: folder.id, name: folder.name, type: 'folder' });
  return targets;
}

export function serializeInvite(
  invite: InviteRecord,
  target: TargetRecord | null,
  user?: { id: string; name: string; email: string } | null,
) {
  return {
    id: invite.id,
    email: invite.inviteeEmail,
    role: invite.role,
    status: invite.status,
    targetType: invite.targetType,
    targetId: invite.targetId,
    target,
    revokedAt: invite.revokedAt?.toISOString() ?? null,
    acceptedAt: invite.acceptedAt?.toISOString() ?? null,
    createdAt: invite.createdAt.toISOString(),
    updatedAt: invite.updatedAt.toISOString(),
    user: user ?? null,
  };
}

export async function listInvites(userId: string) {
  const me = await inviteRepository.findUserEmailById(userId);
  const [sent, received] = await Promise.all([
    inviteRepository.findSentInvites(),
    inviteRepository.findReceivedInvites(me.email),
  ]);
  const allInvites = [...sent, ...received];
  const emails = [...new Set(sent.map((invite) => invite.inviteeEmail))];
  const users = await inviteRepository.findUsersByEmails(emails);
  const userByEmail = new Map(users.map((user) => [user.email, user]));
  const acceptedInvites = sent.filter(
    (invite) => invite.status === 'pending' && userByEmail.has(invite.inviteeEmail),
  );
  if (acceptedInvites.length > 0)
    await inviteRepository.markInvitesAccepted(acceptedInvites.map((invite) => invite.id));
  const targetByKey = await resolveTargets(allInvites);
  const sentInvites = sent.map((invite) =>
    serializeInvite(
      {
        ...invite,
        status: userByEmail.has(invite.inviteeEmail) ? 'accepted' : invite.status,
        acceptedAt: userByEmail.has(invite.inviteeEmail)
          ? (invite.acceptedAt ?? new Date())
          : invite.acceptedAt,
      },
      targetByKey.get(`${invite.targetType}:${invite.targetId}`) ?? null,
      userByEmail.get(invite.inviteeEmail),
    ),
  );
  const receivedInvites = received.map((invite) =>
    serializeInvite(invite, targetByKey.get(`${invite.targetType}:${invite.targetId}`) ?? null),
  );
  return { sent: sentInvites, received: receivedInvites, invites: sentInvites };
}

export async function createInvite(
  userId: string,
  body: { email: string; role: 'viewer' | 'editor'; targetType: 'file' | 'folder'; targetId: string },
) {
  const email = normalizeEmail(body.email);
  const inviter = await inviteRepository.findUserEmailById(userId);
  if (email === inviter.email)
    throw new HttpError(400, 'INVITE_SELF_NOT_ALLOWED', 'You cannot invite yourself.');
  await assertTargetExists(body.targetType, body.targetId);
  const existingUser = await inviteRepository.findUserByEmail(email);
  const invite = await inviteRepository.upsertInvite({
    inviterId: userId,
    inviteeEmail: email,
    role: body.role,
    targetType: body.targetType,
    targetId: body.targetId,
    status: existingUser ? 'accepted' : 'pending',
    acceptedAt: existingUser ? new Date() : null,
  });
  const targetByKey = await resolveTargets([invite]);
  return serializeInvite(
    invite,
    targetByKey.get(`${invite.targetType}:${invite.targetId}`) ?? null,
    existingUser,
  );
}

export async function revokeInvite(id: string) {
  const result = await inviteRepository.revokeInviteById(id);
  if (result.count === 0) throw new HttpError(404, 'INVITE_NOT_FOUND', 'Invite not found.');
}
