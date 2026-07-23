import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password', () => {
  it('hashes to an argon2 string that is not the plaintext', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).not.toBe('correct horse battery staple');
    expect(hash.startsWith('$argon2')).toBe(true);
  });

  it('verifies the correct password', async () => {
    const hash = await hashPassword('s3cret-pass');
    expect(await verifyPassword(hash, 's3cret-pass')).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('s3cret-pass');
    expect(await verifyPassword(hash, 'wrong-pass')).toBe(false);
  });

  it('produces distinct hashes for the same password (random salt)', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });
});
