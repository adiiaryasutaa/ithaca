import {
  clearAuthSession,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '@/lib/auth';

const isProd = import.meta.env.PROD;
const rawApiUrl = import.meta.env.VITE_API_URL;
export const API_URL =
  rawApiUrl && rawApiUrl !== 'http://localhost:4000'
    ? rawApiUrl
    : isProd
      ? '/api'
      : 'http://localhost:4000';

type ApiOptions = RequestInit & { skipAuth?: boolean; retry?: boolean };

async function requestRefresh() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) return false;
  const data = (await response.json()) as { accessToken: string; refreshToken?: string };
  setAccessToken(data.accessToken);
  // The backend rotates the refresh token on every use — persist the new one or the
  // next refresh replays a token the server has already retired.
  if (data.refreshToken) setRefreshToken(data.refreshToken);
  return true;
}

// A page that fires N requests in parallel gets N simultaneous 401s when the access token
// lapses. Without this, each would POST /auth/refresh with the same token; the first
// rotates it and the rest replay a hash the server already retired, failing and logging the
// user out. All callers share one in-flight refresh instead.
let inFlightRefresh: Promise<boolean> | null = null;

function refreshAccessToken() {
  if (!inFlightRefresh) {
    inFlightRefresh = requestRefresh().finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getAccessToken();
  if (!options.skipAuth && token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type'))
    headers.set('Content-Type', 'application/json');

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (
    response.status === 401 &&
    options.retry !== false &&
    !options.skipAuth &&
    (await refreshAccessToken())
  ) {
    return apiFetch<T>(path, { ...options, retry: false });
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    // ACCOUNT_DISABLED is a 403, but the session is dead — drop it and bounce to login
    // rather than leaving the user on a page that 403s on every request.
    if (error.code === 'ACCOUNT_DISABLED') {
      clearAuthSession();
      window.location.assign('/login');
    } else if (response.status === 401) {
      clearAuthSession();
    }
    throw new Error(error.message ?? 'Request failed');
  }

  return response.json() as Promise<T>;
}

export function formatBytes(input: string | number | bigint | null | undefined) {
  if (input === null || input === undefined) return '--';
  const bytes = Number(input);
  if (!Number.isFinite(bytes)) return '--';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}
