import type { IncomingMessage, ServerResponse } from 'http';
import { createApiApp } from '../server/src/app.ts';

// Vercel Serverless Function entrypoint for all /api/* routes.
// Static Vite assets in dist/ are served directly by Vercel's CDN per vercel.json.
const app = createApiApp();

export function normalizeVercelRequestUrl(req: {
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
}): void {
  const rawUrl = req.url || '/';

  // Recover original /api/* path if Vercel rewrite passes /api without subpath
  if ((rawUrl === '/api' || rawUrl.startsWith('/api?')) && req.headers) {
    const originalHeader =
      req.headers['x-vercel-original-url'] ||
      req.headers['x-forwarded-uri'] ||
      req.headers['x-rewrite-url'];
    const original = Array.isArray(originalHeader) ? originalHeader[0] : originalHeader;
    if (typeof original === 'string' && original.startsWith('/api/')) {
      req.url = original;
      return;
    }
  }

  // Restore /api prefix if a serverless rewrite stripped /api (e.g. /v1/... or /health)
  if (
    rawUrl === '/health' ||
    rawUrl.startsWith('/health?') ||
    rawUrl === '/v1' ||
    rawUrl.startsWith('/v1/')
  ) {
    req.url = `/api${rawUrl}`;
  }
}

export { app };

export default function handler(req: IncomingMessage, res: ServerResponse) {
  normalizeVercelRequestUrl(req);
  return app(req, res);
}
