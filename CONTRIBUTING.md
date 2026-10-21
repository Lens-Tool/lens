# Contributing to LENS

## Workflow in one minute

1. Pick a task assigned to you in ClickUp (ID like `S1-15`).
2. Create a branch from an up-to-date `develop`: `git switch develop && git pull && git switch -c feat/S1-15-compress-baseline`.
3. Commit small and often using [Conventional Commits](https://www.conventionalcommits.org/): `feat(connector): add read_file_compressed tool`.
4. Run `npm run check` (lint, format, build, test typecheck, tests) before pushing.
5. Open a pull request **into `develop`** using the template. Include the task ID.
6. One teammate who does not own the change reviews it (see Review rules). Merge with a **merge commit** (squash is disabled) when approved and CI is green.
7. At the end of a sprint the lead opens a release PR `develop` -> `main`.

Details: `docs/branching-workflow.md`.

## Branch names

`<type>/<TaskID>-<short-slug>`, created from `develop`, where type is `feat`, `fix`, `docs`, `chore`, `test` or `spike`.

## Commit types and scopes

Types: `feat`, `fix`, `docs`, `test`, `chore`, `refactor`. Scopes: `shared`, `compression`, `task-context`, `connector`, `stats-api`, `dashboard`, `eval`, `infra`.

## Review rules

- Nobody merges their own PR. At least 1 approval; 2 for changes to `packages/shared` (shared contracts).
- Review within 24 hours on weekdays; if blocked, post in the team chat and tag the task in ClickUp as Blocked.
- Reviewers check: tests exist, contracts unchanged or documented, no private data in logs or events.

## Privacy rule (non-negotiable)

Source code, prompt text and file paths must never be sent to the statistics backend, written to logs that leave the machine, or committed as fixtures from real projects. The only cloud-bound shape is `UsageEvent` in `@lens/shared`.

## Definition of Done

See `docs/conventions.md`.
