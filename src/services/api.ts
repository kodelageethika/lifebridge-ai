const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

// Security hardening: Bearer tokens are kept strictly in memory (never localStorage or sessionStorage).
// HTTP-only SameSite cookies handle session persistence across browser refreshes cleanly.
let inMemoryToken: string | null = null;

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getStoredToken(): string | null {
  return inMemoryToken;
}

export function setStoredToken(token: string | null): void {
  inMemoryToken = token;
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    body?: unknown;
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Requested-With': 'LifeBridge-SPA',
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    headers,
    credentials: 'include',
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const payload = await res.json().catch(() => null);

  if (!res.ok || !payload?.success) {
    const code = payload?.error?.code || 'REQUEST_FAILED';
    const message = payload?.error?.message || `Request failed with status ${res.status}`;
    throw new ApiError(res.status, code, message, payload?.error?.details);
  }

  return payload.data as T;
}
