import { createApp } from './app.js';
import { loadEnv } from './config.js';
import { createDb, PostgresEventStore } from './postgresEventStore.js';

loadEnv();

const port = Number(process.env.PORT ?? 4000);
const store = new PostgresEventStore(createDb());

createApp(store).listen(port, () => {
  console.log(`[lens] stats-api listening on :${port}`);
});
