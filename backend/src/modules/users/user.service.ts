import { createAuditLog } from '../../utils/audit.js';
import { normalizeEmail } from '../../utils/email.js';
import { HttpError } from '../../utils/http-error.js';
import { hashPassword } from '../../utils/password.js';
import * as userRepository from './user.repository.js';

export function serializeUser(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function listUsers() {
  const users = await userRepository.findAllUsers();
  return users.map(serializeUser);
}

export async function getUser(id: string) {
  const user = await userRepository.findUserByIdOrThrow(id);
  return serializeUser(user);
}

export async function createUser(
  actorUserId: string,
  body: { name: string; email: string; password: string; role: 'user' | 'admin' },
) {
  const email = normalizeEmail(body.email);
  const existing = await userRepository.findUserByEmail(email);
  if (existing) throw new HttpError(409, 'EMAIL_TAKEN', 'Email already registered.');
  const user = await userRepository.createUser({
    name: body.name,
    email,
    passwordHash: await hashPassword(body.password),
    role: body.role,
  });
  await createAuditLog(actorUserId, 'CREATE_USER', 'user', user.id, {
    email: user.email,
    role: user.role,
  });
  return serializeUser(user);
}

export async function updateUser(
  actorUserId: string,
  id: string,
  body: {
    name?: string;
    email?: string;
    password?: string;
    role?: 'user' | 'admin';
    status?: 'active' | 'disabled';
  },
) {
  // Same guard as DELETE: disabling yourself revokes your own session mid-request, and if
  // you are the only admin nothing can re-enable the account.
  if (body.status === 'disabled' && id === actorUserId)
    throw new HttpError(400, 'CANNOT_DISABLE_SELF', 'You cannot disable your own account.');
  const data: {
    name?: string;
    email?: string;
    role?: string;
    status?: string;
    passwordHash?: string;
  } = {
    name: body.name,
    email: body.email ? normalizeEmail(body.email) : undefined,
    role: body.role,
    status: body.status,
  };
  if (body.password) data.passwordHash = await hashPassword(body.password);
  const user = await userRepository.updateUser(id, data);
  if (body.status === 'disabled') await userRepository.revokeUserSessions(id);
  await createAuditLog(actorUserId, 'UPDATE_USER', 'user', id, { fields: Object.keys(body) });
  return serializeUser(user);
}

export async function disableUser(actorUserId: string, id: string) {
  if (id === actorUserId)
    throw new HttpError(400, 'CANNOT_DELETE_SELF', 'You cannot disable your own account.');
  await userRepository.updateUser(id, { status: 'disabled' });
  await userRepository.revokeUserSessions(id);
  await createAuditLog(actorUserId, 'DISABLE_USER', 'user', id);
}
