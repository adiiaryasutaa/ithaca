import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { signAccessToken, verifyAccessToken } from './jwt.js';

describe('jwt', () => {
  it('roundtrips the payload through sign -> verify', () => {
    const token = signAccessToken({ sub: 'user-1', sid: 'session-1' });
    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe('user-1');
    expect(decoded.sid).toBe('session-1');
  });

  it('embeds an expiry claim', () => {
    const decoded = jwt.decode(signAccessToken({ sub: 'u', sid: 's' })) as {
      exp?: number;
      iat?: number;
    };
    expect(decoded.exp).toBeGreaterThan(decoded.iat!);
  });

  it('throws on a tampered token', () => {
    const token = signAccessToken({ sub: 'u', sid: 's' });
    const tampered = token.slice(0, -3) + 'aaa';
    expect(() => verifyAccessToken(tampered)).toThrow();
  });

  it('throws when signed with a different secret', () => {
    const foreign = jwt.sign({ sub: 'u', sid: 's' }, 'some-other-secret-key-32-chars-min-xx');
    expect(() => verifyAccessToken(foreign)).toThrow();
  });
});
