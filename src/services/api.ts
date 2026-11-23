export function normalizeApiBase(rawBase: string | undefined): string {
  const trimmed = (rawBase || '').trim().replace(/\/+$/, '');
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return '';
  // Guard against VITE_API_BASE_URL accidentally including /api, /api/v1, or /api/vl suffixes
  const cleaned = trimmed.replace(/\/api(?:\/v[1l])?$/i, '');
  // Never target a static GitHub Pages host as an API backend
  try {
    const parsed = new URL(cleaned);
    if (parsed.hostname.endsWith('.github.io')) {
      return '';
    }
  } catch {
    // Allow relative or non-URL strings to fall through cleanly
  }
  return cleaned;
}

export function buildApiUrl(path: string, rawBase: string | undefined = import.meta.env.VITE_API_BASE_URL): string {
  const apiBase = normalizeApiBase(rawBase);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${apiBase}${normalizedPath}`;
}

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

  const apiBase = normalizeApiBase(import.meta.env.VITE_API_BASE_URL);
  if (
    !apiBase &&
    typeof window !== 'undefined' &&
    window.location?.hostname?.endsWith('.github.io')
  ) {
    throw new ApiError(
      405,
      'STATIC_HOST_MISSING_API_BASE_URL',
      'GitHub Pages cannot execute backend API requests without VITE_API_BASE_URL pointing to your deployed backend or Vercel full-stack URL.'
    );
  }

  const targetUrl = buildApiUrl(path);
  const method = options.method || 'GET';

  const res = await fetch(targetUrl, {
    method,
    headers,
    credentials: 'include',
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const payload = await res.json().catch(() => null);

  if (res.status === 405 && !payload) {
    throw new ApiError(
      405,
      'METHOD_NOT_ALLOWED_STATIC_HOST',
      `HTTP 405 Method Not Allowed for ${method} ${targetUrl}. Ensure the Express backend is running or VITE_API_BASE_URL / Vercel /api rewrites are active.`
    );
  }

  if (!res.ok) {
    const code = payload?.error?.code || (payload === null ? 'NON_JSON_API_RESPONSE' : 'REQUEST_FAILED');
    const message =
      payload?.error?.message ||
      (payload === null
        ? `HTTP ${res.status} (${res.statusText || 'Error'}) from ${method} ${targetUrl}: Expected JSON from LifeBridge API backend. Verify VITE_API_BASE_URL.`
        : `Request failed with status ${res.status}`);
    throw new ApiError(res.status, code, message, payload?.error?.details);
  }

  if (!payload?.success) {
    const code = payload?.error?.code || 'INVALID_API_RESPONSE';
    const message =
      payload?.error?.message ||
      `Unexpected non-API response from ${method} ${targetUrl}. Verify VITE_API_BASE_URL points to the Express backend.`;
    throw new ApiError(res.status, code, message, payload?.error?.details);
  }

  return payload.data as T;
}
