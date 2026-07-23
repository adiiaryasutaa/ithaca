import { describe, it, expect } from 'vitest';
import { encryptText, decryptText, hashToken, randomToken } from './crypto.js';

describe('crypto', () => {
  describe('encryptText / decryptText', () => {
    it('roundtrips a value back to plaintext', () => {
      const plaintext = 'super-secret-refresh-token';
      const encrypted = encryptText(plaintext);
      expect(encrypted).not.toBe(plaintext);
      expect(decryptText(encrypted)).toBe(plaintext);
    });

    it('produces the iv:tag:ciphertext shape', () => {
      const encrypted = encryptText('hello');
      expect(encrypted.split(':')).toHaveLength(3);
    });

    it('produces different ciphertext each call (random iv)', () => {
      expect(encryptText('same')).not.toBe(encryptText('same'));
    });

    it('roundtrips unicode', () => {
      expect(decryptText(encryptText('café ☕ 你好'))).toBe('café ☕ 你好');
    });

    it('throws on malformed payload', () => {
      expect(() => decryptText('not-valid')).toThrow('Invalid encrypted payload');
      expect(() => decryptText('only:two')).toThrow('Invalid encrypted payload');
    });

    it('throws when the auth tag does not match (tampered ciphertext)', () => {
      const [iv, tag] = encryptText('payload').split(':');
      const tampered = `${iv}:${tag}:${Buffer.from('tampered').toString('base64')}`;
      expect(() => decryptText(tampered)).toThrow();
    });
  });

  describe('hashToken', () => {
    it('is deterministic and returns 64-char hex', () => {
      const a = hashToken('abc');
      const b = hashToken('abc');
      expect(a).toBe(b);
      expect(a).toMatch(/^[0-9a-f]{64}$/);
    });

    it('differs for different input', () => {
      expect(hashToken('abc')).not.toBe(hashToken('abd'));
    });
  });

  describe('randomToken', () => {
    it('returns a base64url string and is unique across calls', () => {
      const a = randomToken();
      const b = randomToken();
      expect(a).not.toBe(b);
      expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('honors the byte-length argument', () => {
      // 8 bytes -> base64url without padding is ceil(8*4/3) = 11 chars
      expect(randomToken(8)).toHaveLength(11);
    });
  });
});
