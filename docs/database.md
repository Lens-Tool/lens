# Statistics database (PostgreSQL)

The statistics API (`apps/stats-api`) stores anonymous usage events in PostgreSQL. It only needs a connection string in `DATABASE_URL`, so any PostgreSQL works: a local Docker container, a hosted database such as Supabase, or Render/Railway later.

## 1. Choose where the database runs

| Option                | Good for                                     | Needs                                        |
| --------------------- | -------------------------------------------- | -------------------------------------------- |
| **Docker (local)**    | Private development and tests on your laptop | Docker Desktop, then `npm run db:up`         |
| **Supabase (hosted)** | A shared database the whole team can reach   | A Supabase project and its connection string |

Only the people working on the backend need one of these. Everyone else can ignore this page: `npm run check` works without a database.

### Docker

```bash
cp .env.example .env
npm run db:up
# in .env:
# DATABASE_URL=postgres://lens:lens_dev_password@localhost:5432/lens
```

### Supabase

1. Create a project, then open **Connect** and copy the **Session pooler** connection string.
2. Put it in your own `.env` as `DATABASE_URL` (the `.env` file is ignored by Git).
3. If the connection fails with an SSL error, add `?sslmode=require` to the string.
4. **Never** write a real connection string or password in `.env.example`, in a PR, in chat screenshots or in docs. If one leaks, reset the database password immediately.

## 2. Create the tables (migrations)

The schema lives in the repo as SQL files in `apps/stats-api/migrations/`. Apply them with:

```bash
npm run db:migrate -w @lens/stats-api
```

The command applies only the migrations that have not run yet (it records them in a `schema_migrations` table) and is safe to run again. To change the schema, add a new numbered file such as `002_add_something.sql`; never edit one that has already been applied.

## 3. Start the API

```bash
npm run dev:stats          # http://localhost:4000/health
curl http://localhost:4000/v1/stats/summary
```

## 4. What is stored

Only the fields of `UsageEvent` (`packages/shared`), nothing else:

| Table          | Columns                                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `projects`     | `id` (random anonymous id), `created_at`                                                                               |
| `sessions`     | `id`, `project_id`, `started_at`                                                                                       |
| `usage_events` | `id`, `project_id`, `session_id`, `tool`, `tokens_before`, `tokens_after`, `duration_ms`, `occurred_at`, `received_at` |

Do not add columns for file paths, prompt text, code, project names or user names (see `docs/adr/0002-privacy-boundary.md` and `0003-anonymous-ids.md`). A test checks the list of columns.

## 5. Database tests

`apps/stats-api/src/postgresEventStore.test.ts` runs against a real database and is skipped unless `TEST_DATABASE_URL` is set. Use an empty database whose name contains `test`, because the test drops the LENS tables first:

```bash
# Docker example
docker compose exec postgres psql -U lens -c "CREATE DATABASE lens_test"
TEST_DATABASE_URL=postgres://lens:lens_dev_password@localhost:5432/lens_test npm test
```

On PowerShell use `$env:TEST_DATABASE_URL="..."; npm test`. Never point it at the shared or production database.
