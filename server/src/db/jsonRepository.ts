import fs from 'fs';
import path from 'path';
import { env } from '../config/env.ts';
import { type DatabaseState } from '../types/index.ts';
import { type DatabaseRepository, type DbHealthStatus } from './repository.ts';
import { buildSeedDatabase } from './seed.ts';

export class JsonFileRepository implements DatabaseRepository {
  public readonly driver = 'json' as const;
  private cachedDb: DatabaseState | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  private getDbFilePath(): string {
    if (process.env.DB_PATH) {
      return path.resolve(process.cwd(), process.env.DB_PATH);
    }
    return env.DB_PATH;
  }

  private ensureDir(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private writeAtomic(filePath: string, data: DatabaseState): void {
    this.ensureDir(filePath);
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, filePath);
  }

  public loadSync(): DatabaseState {
    const filePath = this.getDbFilePath();
    if (this.cachedDb) {
      return this.cachedDb;
    }

    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw) as DatabaseState;
        this.cachedDb = parsed;
        return parsed;
      } catch (err) {
        console.error('Failed to parse persisted JSON DB file, re-seeding cleanly:', err);
      }
    }

    const seeded = buildSeedDatabase();
    this.writeAtomic(filePath, seeded);
    this.cachedDb = seeded;
    return seeded;
  }

  public async readState(): Promise<DatabaseState> {
    await this.writeQueue;
    return this.loadSync();
  }

  public async mutateState<T>(mutator: (db: DatabaseState) => T | Promise<T>): Promise<T> {
    const op = this.writeQueue.then(async () => {
      const db = this.loadSync();
      try {
        const result = await mutator(db);
        this.writeAtomic(this.getDbFilePath(), db);
        this.cachedDb = db;
        return result;
      } catch (err) {
        this.cachedDb = null;
        throw err;
      }
    });

    this.writeQueue = op.then(
      () => undefined,
      () => undefined
    );
    return op;
  }

  public async healthCheck(): Promise<DbHealthStatus> {
    const started = Date.now();
    try {
      const filePath = this.getDbFilePath();
      const db = await this.readState();
      const exists = fs.existsSync(filePath);
      return {
        driver: 'json',
        healthy: exists && Array.isArray(db.hospitals) && Array.isArray(db.organConfigs),
        latencyMs: Date.now() - started,
        detail: exists
          ? `Atomic JSON persistence active (${db.donors.length} donors, ${db.recipients.length} recipients)`
          : 'JSON store initialized in memory',
      };
    } catch (err) {
      return {
        driver: 'json',
        healthy: false,
        latencyMs: Date.now() - started,
        detail: err instanceof Error ? err.message : 'JSON storage check failed',
      };
    }
  }

  public async reseed(): Promise<DatabaseState> {
    return this.mutateState((db) => {
      const fresh = buildSeedDatabase();
      Object.assign(db, fresh);
      return db;
    });
  }

  public resetCache(): void {
    this.cachedDb = null;
  }

  public async disconnect(): Promise<void> {
    await this.writeQueue;
  }
}
