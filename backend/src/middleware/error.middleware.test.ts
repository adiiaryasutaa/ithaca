import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { errorMiddleware } from './error.middleware.js';

function mockRes() {
  const res = {
    status: vi.fn(() => res),
    json: vi.fn(() => res),
  } as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
  return res;
}

const req = {} as Request;
const next = vi.fn();

function getZodError() {
  const result = z.object({ name: z.string() }).safeParse({ name: 123 });
  if (result.success) throw new Error('expected zod parse to fail');
  return result.error;
}

describe('errorMiddleware', () => {
  it('maps ZodError to 400 VALIDATION_ERROR with issues', () => {
    const res = mockRes();
    errorMiddleware(getZodError(), req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(body.issues)).toBe(true);
    expect(body.issues[0]).toHaveProperty('path');
    expect(body.issues[0]).toHaveProperty('message');
  });

  it('maps Prisma P2025 to 404 NOT_FOUND', () => {
    const res = mockRes();
    const err = new Prisma.PrismaClientKnownRequestError('not found', {
      code: 'P2025',
      clientVersion: 'test',
    });
    errorMiddleware(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0].code).toBe('NOT_FOUND');
  });

  it('maps Prisma P2002 to 409 CONFLICT', () => {
    const res = mockRes();
    const err = new Prisma.PrismaClientKnownRequestError('unique', {
      code: 'P2002',
      clientVersion: 'test',
    });
    errorMiddleware(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].code).toBe('CONFLICT');
  });

  it('falls through unknown Prisma codes to 500', () => {
    const res = mockRes();
    const err = new Prisma.PrismaClientKnownRequestError('boom', {
      code: 'P2003',
      clientVersion: 'test',
    });
    errorMiddleware(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('maps a generic Error to 500 echoing its message', () => {
    const res = mockRes();
    errorMiddleware(new Error('something broke'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0];
    expect(body.code).toBe('INTERNAL_SERVER_ERROR');
    expect(body.message).toBe('something broke');
  });

  it('maps a non-Error throwable to a 500 with fallback message', () => {
    const res = mockRes();
    errorMiddleware('just a string', req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].message).toBe('Internal server error');
  });
});
