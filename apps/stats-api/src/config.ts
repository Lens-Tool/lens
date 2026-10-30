import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

/** Loads the .env file from the repo root (it is not inside apps/stats-api). */
export function loadEnv(): void {
  const here = path.dirname(fileURLToPath(import.meta.url));
  dotenv.config({ path: path.resolve(here, '../../../.env') });
}

export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env and set a PostgreSQL connection string (see docs/database.md).',
    );
  }
  return url;
}
