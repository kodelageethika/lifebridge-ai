import { createApiApp } from '../server/src/app.ts';

// Vercel Serverless Function entrypoint for all /api/* routes.
// Static Vite assets in dist/ are served directly by Vercel's CDN per vercel.json.
const app = createApiApp();

export default app;
