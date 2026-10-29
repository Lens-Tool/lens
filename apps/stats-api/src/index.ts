import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createApp } from './app.js';
import { createDb, PostgresEventStore } from './postgresEventStore.js';

// .env lives in the repo root, not in apps/stats-api
const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '../../../.env') });

const port = Number(process.env.PORT ?? 4000);
const store = new PostgresEventStore(createDb());

createApp(store).listen(port, () => {
  console.log(`[lens] stats-api listening on :${port}`);
});
