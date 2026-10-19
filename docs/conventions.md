# Team conventions

## Definition of Ready (task can enter a sprint)

- Has an owner and a reviewer, an estimate, and acceptance criteria as a checklist.
- Dependencies are listed and either done or scheduled earlier in the sprint.

## Definition of Done (task is finished)

- Code merged to `main` through a reviewed PR with green CI.
- Tests cover the new behaviour (or the spike produced a written finding).
- Docs/ADR updated if a contract, decision or setup step changed.
- Evidence attached to the ClickUp task (PR link, doc link or short demo).

## GitHub and ClickUp

- ClickUp is the source of truth for status, owner, estimate and priority.
- GitHub is the source of truth for code, review discussion and ADRs.
- Link them by ID only: put `T19` in the branch, PR title and commit scope; paste the PR link in the ClickUp task. Do not copy descriptions between them.

## Ceremonies

- Async daily update in the team chat (yesterday / today / blocked), max 3 lines.
- Two 30-minute syncs per week; sprint planning (60 min) on Day 1; review (45 min) and retrospective (30 min) on the last day.

## Error handling

Throw `LensError` with a code from `@lens/shared`. MCP tools return `isError: true` with `CODE: message`; the HTTP API returns `{ "error": { "code", "message" } }`.

## Tests

- Tests live next to the code they test, inside the package's `src/` folder.
- Name test files `<module>.test.ts`, for example `privacy.test.ts` next to `privacy.ts`.
- Test files are typechecked with `npm run typecheck:tests` and must pass in CI.
- Fixtures in `fixtures/` are small, invented examples: never copy code from real projects.
- Never put API keys, prompts or file paths from a real machine into tests or fixtures.
