import type { Response } from 'express';
import { env } from '../../config/env.js';

export type StreamDisposition = 'inline' | 'attachment';

// `mimeType` is whatever the uploader claimed (upload.routes.ts takes it from a multipart
// field), and public share links serve it unauthenticated from the same origin as the SPA.
// Only render types that cannot execute script inline; everything else downloads.
const INLINE_SAFE_EXACT = new Set([
  'application/pdf',
  'image/apng',
  'image/avif',
  'image/bmp',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/x-icon',
  'text/plain',
]);

const INLINE_SAFE_PREFIXES = ['audio/', 'video/'];

function isInlineSafe(mimeType: string) {
  const type = mimeType.split(';')[0]!.trim().toLowerCase();
  // image/svg+xml is deliberately absent: SVG is a script execution vector.
  return INLINE_SAFE_EXACT.has(type) || INLINE_SAFE_PREFIXES.some((p) => type.startsWith(p));
}

function contentDisposition(type: StreamDisposition, fileName: string) {
  return `${type}; filename="${fileName.replaceAll('"', '')}"`;
}

/**
 * Sets Content-Type/Disposition plus the anti-XSS headers for a provider file stream.
 * Downgrades `inline` to `attachment` for any type a browser might execute.
 */
export function applyStreamHeaders(
  res: Response,
  file: { mimeType: string; fileName: string },
  disposition: StreamDisposition | undefined,
) {
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Overwrites helmet's CSP for this response, so it has to restate frame-ancestors —
  // helmet's copy is gone once this header is set, and app.ts disables X-Frame-Options,
  // which would otherwise be the fallback. Same allowlist helmet uses, so the SPA can
  // still <iframe> a PDF preview.
  res.setHeader(
    'Content-Security-Policy',
    `sandbox; default-src 'none'; frame-ancestors 'self' ${env.FRONTEND_URL}`,
  );
  if (!disposition) return;
  const effective: StreamDisposition =
    disposition === 'inline' && !isInlineSafe(file.mimeType) ? 'attachment' : disposition;
  res.setHeader('Content-Disposition', contentDisposition(effective, file.fileName));
}
