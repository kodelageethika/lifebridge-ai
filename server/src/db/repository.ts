import { type DatabaseState } from '../types/index.ts';

export type DbDriverType = 'json' | 'postgres';

export interface DbHealthStatus {
  driver: DbDriverType;
  healthy: boolean;
  latencyMs: number;
  detail: string;
}

export interface DatabaseRepository {
  readonly driver: DbDriverType;
  readState(): Promise<DatabaseState>;
  mutateState<T>(mutator: (db: DatabaseState) => T | Promise<T>): Promise<T>;
  healthCheck(): Promise<DbHealthStatus>;
  reseed(): Promise<DatabaseState>;
  resetCache(): void;
  disconnect(): Promise<void>;
}
