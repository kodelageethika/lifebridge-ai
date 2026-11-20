import { env } from '../config/env.ts';
import { type DatabaseState } from '../types/index.ts';
import { JsonFileRepository } from './jsonRepository.ts';
import { PostgresPrismaRepository } from './postgresRepository.ts';
import { type DatabaseRepository, type DbDriverType, type DbHealthStatus } from './repository.ts';

const jsonRepo = new JsonFileRepository();
const postgresRepo = new PostgresPrismaRepository();

let forcedDriverForTest: DbDriverType | null = null;

export function setDbDriverForTest(driver: DbDriverType | null): void {
  forcedDriverForTest = driver;
}

export function getDbDriver(): DbDriverType {
  if (forcedDriverForTest) return forcedDriverForTest;
  const raw = (process.env.DB_DRIVER || '').trim().toLowerCase();
  if (raw === 'postgres' || raw === 'postgresql') return 'postgres';
  if (raw === 'json') return 'json';
  return env.DB_DRIVER;
}

export function getActiveRepository(): DatabaseRepository {
  return getDbDriver() === 'postgres' ? postgresRepo : jsonRepo;
}

export async function readDb(): Promise<DatabaseState> {
  return getActiveRepository().readState();
}

export async function mutateDb<T>(mutator: (db: DatabaseState) => T | Promise<T>): Promise<T> {
  return getActiveRepository().mutateState(mutator);
}

export async function checkDatabaseHealth(): Promise<DbHealthStatus> {
  return getActiveRepository().healthCheck();
}

export function resetDbCache(): void {
  jsonRepo.resetCache();
  postgresRepo.resetCache();
}

export async function reseedDatabase(): Promise<DatabaseState> {
  return getActiveRepository().reseed();
}

export async function disconnectDb(): Promise<void> {
  await Promise.all([jsonRepo.disconnect(), postgresRepo.disconnect()]);
}
