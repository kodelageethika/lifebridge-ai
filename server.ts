import express from 'express';
import fs from 'fs';
import path from 'path';
import { env, validateProductionEnv } from './server/src/config/env.ts';
import { createApiApp } from './server/src/app.ts';
import { disconnectDb } from './server/src/db/database.ts';
import { errorHandler } from './server/src/middleware/errorHandler.ts';

async function startServer() {
  validateProductionEnv();
  const app = createApiApp();

  const apiOnlyMode = process.argv.includes('--api-only') || process.env.BACKEND_ONLY === 'true';

  if (env.IS_PROD) {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  } else if (!apiOnlyMode) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.use(errorHandler);

  const server = app.listen(env.PORT, '0.0.0.0', () => {
    console.log(
      `LifeBridge AI server listening on http://0.0.0.0:${env.PORT} (${env.NODE_ENV}, db=${env.DB_DRIVER})`
    );
  });

  const gracefulShutdown = async (signal: string) => {
    console.log(`Received ${signal}. Closing HTTP server and database connections...`);
    server.close(async () => {
      await disconnectDb().catch(() => undefined);
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
}

startServer().catch(err => {
  console.error('Failed to start LifeBridge AI server:', err);
  process.exit(1);
});
