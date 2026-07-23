import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { requireAuth, requireAdmin, type AuthRequest } from '../../middleware/auth.middleware.js';
import { hashPassword } from '../../utils/password.js';
import { createAuditLog } from '../../utils/audit.js';

export const userRouter = Router();
userRouter.use(requireAuth, requireAdmin);

const createSchema = z.object({
  name: z.string().trim().min(2).max(191),
  email: z.string().trim().email().max(191),
  password: z.string().min(8),
  role: z.enum(['user', 'admin']).default('user'),
});

const updateSchema = z.object({
  name: z.string().trim().min(2).max(191).optional(),
  email: z.string().trim().email().max(191).optional(),
  password: z.string().min(8).optional(),
  role: z.enum(['user', 'admin']).optional(),
  status: z.enum(['active', 'disabled']).optional(),
});

function serializeUser(user: {
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

userRouter.get('/', async (_req: AuthRequest, res, next) => {
  try {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    return res.json({ users: users.map(serializeUser) });
  } catch (error) {
    return next(error);
  }
});

userRouter.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: String(req.params.id) } });
    return res.json({ user: serializeUser(user) });
  } catch (error) {
    return next(error);
  }
});

userRouter.post('/', async (req: AuthRequest, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing)
      return res.status(409).json({ code: 'EMAIL_TAKEN', message: 'Email already registered.' });
    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        passwordHash: await hashPassword(body.password),
        role: body.role,
      },
    });
    await createAuditLog(req.user!.id, 'CREATE_USER', 'user', user.id, {
      email: user.email,
      role: user.role,
    });
    return res.status(201).json({ user: serializeUser(user) });
  } catch (error) {
    return next(error);
  }
});

userRouter.patch('/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = String(req.params.id);
    const body = updateSchema.parse(req.body);
    const data: {
      name?: string;
      email?: string;
      role?: string;
      status?: string;
      passwordHash?: string;
    } = {
      name: body.name,
      email: body.email,
      role: body.role,
      status: body.status,
    };
    if (body.password) data.passwordHash = await hashPassword(body.password);
    const user = await prisma.user.update({ where: { id }, data });
    await createAuditLog(req.user!.id, 'UPDATE_USER', 'user', id, {
      fields: Object.keys(body),
    });
    return res.json({ user: serializeUser(user) });
  } catch (error) {
    return next(error);
  }
});

userRouter.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = String(req.params.id);
    if (id === req.user!.id)
      return res
        .status(400)
        .json({ code: 'CANNOT_DELETE_SELF', message: 'You cannot disable your own account.' });
    await prisma.user.update({ where: { id }, data: { status: 'disabled' } });
    await createAuditLog(req.user!.id, 'DISABLE_USER', 'user', id);
    return res.json({ status: 'ok' });
  } catch (error) {
    return next(error);
  }
});
