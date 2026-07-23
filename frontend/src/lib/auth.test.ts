import { describe, it, expect, beforeEach } from 'vitest';
import {
  setAuthSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  updateStoredUser,
  setAccessToken,
  clearAuthSession,
  type AuthUser,
} from './auth';

const user: AuthUser = { id: 'u1', name: 'Ada', email: 'ada@example.com' };

beforeEach(() => {
  localStorage.clear();
});

describe('auth session storage', () => {
  it('roundtrips a full session', () => {
    setAuthSession('access-1', 'refresh-1', user);
    expect(getAccessToken()).toBe('access-1');
    expect(getRefreshToken()).toBe('refresh-1');
    expect(getStoredUser()).toEqual(user);
  });

  it('returns null for missing values', () => {
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(getStoredUser()).toBeNull();
  });

  it('updateStoredUser overwrites only the user', () => {
    setAuthSession('access-1', 'refresh-1', user);
    updateStoredUser({ ...user, name: 'Grace' });
    expect(getStoredUser()?.name).toBe('Grace');
    expect(getAccessToken()).toBe('access-1');
  });

  it('setAccessToken updates only the access token', () => {
    setAuthSession('access-1', 'refresh-1', user);
    setAccessToken('access-2');
    expect(getAccessToken()).toBe('access-2');
    expect(getRefreshToken()).toBe('refresh-1');
  });

  it('clearAuthSession removes all three keys', () => {
    setAuthSession('access-1', 'refresh-1', user);
    clearAuthSession();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(getStoredUser()).toBeNull();
  });
});
