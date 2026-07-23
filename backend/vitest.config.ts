import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      DATABASE_URL: 'mysql://test:test@localhost:3306/test',
      FRONTEND_URL: 'http://localhost:5173',
      JWT_ACCESS_SECRET: 'test-jwt-access-secret-at-least-32-chars-long',
      TOKEN_ENCRYPTION_KEY: 'test-token-encryption-key-at-least-32-chars',
    },
  },
});
