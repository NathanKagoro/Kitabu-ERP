#!/usr/bin/env node
/**
 * Applies db/migrations to DATABASE_URL (the Supabase "session" connection
 * string). Includes the hand-written RLS migration, which drizzle-kit tracks in
 * the same journal, so `npm run db:migrate` is the one command for both.
 */
import { config } from 'dotenv';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

config({ path: ['.env.local', '.env'], quiet: true });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('db:migrate — set DATABASE_URL in .env.local (Supabase > Project Settings > Database).');
  process.exit(1);
}

const client = postgres(url, { max: 1, prepare: false });
try {
  await migrate(drizzle(client), { migrationsFolder: './db/migrations' });
  console.log('db:migrate — up to date');
} catch (error) {
  console.error('db:migrate — failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end();
}
