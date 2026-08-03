import { describe, expect, it } from 'vitest';
import type { Response } from 'express';
import { applyStreamHeaders } from './stream-headers.js';

// Node's ServerResponse rejects header values containing anything outside latin1.
// Reproducing that check here is the point of the filename cases below: a plain object
// recorder would happily accept the bytes that crash a real response.
const INVALID_HEADER_CHAR = /[^\t\x20-\x7e\x80-\xff]/;

function mockRes() {
  const headers: Record<string, string> = {};
  const res = {
    setHeader(name: string, value: string) {
      if (INVALID_HEADER_CHAR.test(String(value))) {
        const error = new Error(`Invalid character in header content ["${name}"]`);
        (error as NodeJS.ErrnoException).code = 'ERR_INVALID_CHAR';
        throw error;
      }
      headers[name] = String(value);
    },
  } as unknown as Response;
  return { res, headers };
}

function headersFor(mimeType: string, fileName = 'file.bin', disposition = 'inline' as const) {
  const { res, headers } = mockRes();
  applyStreamHeaders(res, { mimeType, fileName }, disposition);
  return headers;
}

describe('applyStreamHeaders', () => {
  describe('inline-safe allowlist', () => {
    it.each(['application/pdf', 'image/png', 'image/gif', 'image/webp', 'text/plain'])(
      'renders %s inline',
      (mimeType) => {
        expect(headersFor(mimeType)).toMatchObject({
          'Content-Disposition': expect.stringContaining('inline'),
        });
      },
    );

    it.each(['audio/mpeg', 'video/mp4', 'video/webm'])(
      'renders %s inline by prefix',
      (mimeType) => {
        expect(headersFor(mimeType)['Content-Disposition']).toContain('inline');
      },
    );

    // The XSS control: these execute script if a browser renders them, and public share
    // links serve them unauthenticated from the SPA's own origin.
    it.each([
      'image/svg+xml',
      'text/html',
      'application/xhtml+xml',
      'application/javascript',
      'text/xml',
    ])('downgrades %s to attachment even when inline was requested', (mimeType) => {
      expect(headersFor(mimeType)['Content-Disposition']).toContain('attachment');
    });

    it('ignores media-type parameters when matching', () => {
      expect(headersFor('text/plain; charset=utf-8')['Content-Disposition']).toContain('inline');
    });

    it('is case-insensitive', () => {
      expect(headersFor('IMAGE/PNG')['Content-Disposition']).toContain('inline');
    });

    // A comma-joined header is one string, not a list, so it must not match text/plain.
    it('does not treat a comma-joined type as its first member', () => {
      expect(headersFor('text/plain, text/html')['Content-Disposition']).toContain('attachment');
    });

    it('never upgrades an explicit attachment to inline', () => {
      const { res, headers } = mockRes();
      applyStreamHeaders(res, { mimeType: 'application/pdf', fileName: 'a.pdf' }, 'attachment');
      expect(headers['Content-Disposition']).toContain('attachment');
    });
  });

  describe('filename encoding', () => {
    // Regression: these threw ERR_INVALID_CHAR and 500'd every download of such a file.
    it.each([
      ['日本語レポート.pdf', 'CJK'],
      ['emoji-📄.pdf', 'emoji'],
      ['отчёт.pdf', 'Cyrillic'],
      ['αναφορά.pdf', 'Greek'],
      ['résumé.pdf', 'accented latin-1'],
    ])('encodes %s (%s) without throwing', (fileName) => {
      expect(() => headersFor('application/pdf', fileName)).not.toThrow();
    });

    it('emits both an ascii filename and an RFC 5987 filename*', () => {
      const value = headersFor('application/pdf', '日本語.pdf')['Content-Disposition']!;
      expect(value).toMatch(/filename="[\x20-\x7e]*"/);
      expect(value).toContain("filename*=UTF-8''");
      expect(value).toContain(encodeURIComponent('日本語.pdf'));
    });

    it('neutralizes quotes in the filename', () => {
      const value = headersFor('application/pdf', 'a"b.pdf')['Content-Disposition']!;
      expect(value).toMatch(/^inline; filename="[^"]*"/);
    });

    it('cannot inject a second header via CRLF in the filename', () => {
      expect(() => headersFor('application/pdf', 'a\r\nX-Injected: 1.pdf')).not.toThrow();
      const value = headersFor('application/pdf', 'a\r\nX-Injected: 1.pdf')['Content-Disposition']!;
      expect(value).not.toMatch(/[\r\n]/);
    });
  });

  describe('security headers', () => {
    it('sets nosniff and a sandboxed CSP even with no disposition', () => {
      const { res, headers } = mockRes();
      applyStreamHeaders(res, { mimeType: 'image/svg+xml', fileName: 'x.svg' }, undefined);
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['Content-Security-Policy']).toContain("default-src 'none'");
      expect(headers['Content-Security-Policy']).toContain('sandbox');
      expect(headers).not.toHaveProperty('Content-Disposition');
    });

    // Setting CSP here replaces helmet's copy, and app.ts turns X-Frame-Options off, so
    // dropping frame-ancestors would leave streams framable by any origin.
    it("restates frame-ancestors so helmet's framing rule survives", () => {
      expect(headersFor('application/pdf')['Content-Security-Policy']).toContain(
        "frame-ancestors 'self' http://localhost:5173",
      );
    });

    it('passes the claimed mime type through as Content-Type', () => {
      expect(headersFor('image/svg+xml')['Content-Type']).toBe('image/svg+xml');
    });
  });
});
