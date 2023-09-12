import path from 'path';
import { Database } from 'bun:sqlite';

import { drizzle, BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';

import * as schema from './schema';
import logger from './logger';

const sqlite = new Database(path.resolve(__dirname, '../sqlite.db'));
const database: BunSQLiteDatabase<typeof schema> = drizzle(sqlite, { schema });

export function syncMigrations() {
  logger.info('Running migrations...');
  migrate(database, { migrationsFolder: path.resolve(__dirname, '../migrations') });
  logger.info('Migrations complete.');
}

export default database;
