/**
 * Normalize an email address for storage and lookups.
 *
 * MySQL's default collation compared emails case-insensitively, so lookups
 * and the `users.email` unique index effectively ignored case for free.
 * Postgres is case-sensitive by default, so every write and read path must
 * normalize explicitly or logins/duplicate-checks silently regress.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
