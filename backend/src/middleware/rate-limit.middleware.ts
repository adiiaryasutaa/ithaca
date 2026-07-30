import rateLimit from 'express-rate-limit';

// NOTE: these use express-rate-limit's default in-memory store, which is per-process. On
// Vercel that means per-lambda-instance, reset on cold start — it raises the cost of a
// brute-force attempt but is not a hard ceiling. A shared store (Redis/Postgres) is needed
// for that. Counting is also only as good as `trust proxy` in app.ts: verify req.ip on a
// preview deploy, since a wrong hop count buckets every client together.

const shared = { standardHeaders: 'draft-7', legacyHeaders: false } as const;

/** Credential-guessing endpoints: login, Google auth URL, Google handoff exchange. */
export const credentialsLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60_000,
  limit: 30,
  message: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again later.' },
});

/**
 * Refresh is normal high-frequency traffic, not credential guessing — every client hits it
 * each time a 900s access token lapses, and everyone in this shared workspace may share one
 * egress IP. Sharing the tight bucket above would 429 legitimate sessions into a logout.
 */
export const refreshLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60_000,
  limit: 300,
  message: { code: 'RATE_LIMITED', message: 'Too many requests. Try again later.' },
});

/** Unauthenticated share-token endpoints — token enumeration guard. */
export const publicLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60_000,
  limit: 300,
  message: { code: 'RATE_LIMITED', message: 'Too many requests. Try again later.' },
});
