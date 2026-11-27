# Project status

Last updated: 2026-11-23 by: Esraa Ahmed Abo-Elaas
Update this file at the end of every sprint (5 minutes).

## One-paragraph summary

LENS is a local MCP server that gives coding agents only the code a task needs and reports anonymous savings to a dashboard. Foundation work is done and Sprint 2 is underway (tree-sitter compression, real token counter, anonymous IDs, evaluation preparation). The main open risks are: the agent did not call LENS unprompted in the first run, answer quality is not yet measured, and two decisions wait on the supervisor.

## Sprint

- Current sprint: Sprint 2 | Dates: 23-11-2026 | Goal: given a Python file, LENS produces a symbol tree and a signatures-only version that still parses, the agent can get any omitted body back with `expand_symbol`, and we have our first measured token savings.
- Supervisor: Dr. Gaber Hassan

## Done (from the docs)

- Monorepo, CI, lint, format, Vitest, branch protection and branching workflow.
- MCP tools `read_file_compressed` and `expand_symbol` (agent run 1 used commit 2bb44bd with these two tools).
- Privacy-gated `UsageEvent` and minimal statistics API with PostgreSQL migrations.
- Anonymous project/session IDs (ADR 0003, S2-14).
- Syntax-error fallback rule for the AST compressor (S2-07): implemented and documented. `read_file_compressed` returns the raw file with a `[lens warning]` block; `expand_symbol` refuses files with syntax errors.
- Real tokenizer (`js-tiktoken`) and regenerated Python savings report (ADR 0010, 2026-11-22): merged.
- Research: tree-sitter spike (S1-08, report still a draft: Windows and macOS results are empty), secrets patterns (S1-07, draft: patterns not yet checked against official docs), benchmark feasibility (S2-16), agent run 1.
- Release review fixes (S2-19): both tools read only inside the project root, the stats summary reports net savings (`tokensSaved`, can be negative), `NOT_FOUND` for a missing symbol, fixed log messages, non-breaking `npm audit fix`.

## In progress / next (VERIFY against ClickUp)

- Tree-sitter WASM compressor with the four grammar files (S2-02) and TSX test.
- Windows and macOS validation of tree-sitter loading.
- Choose final marker format and default compression level.
- Tool description, `file_path` parameter alias and line numbers in `light` output (hypotheses from agent run 1).
- Task & Context Layer (`prepare_task`), cache/diff, redaction, history compression, dashboard: planned, not started per README.

## Known gaps in this release

- Secrets redaction is not implemented: secrets in a file pass through unchanged in `read_file_compressed` and `expand_symbol`.
- The connector makes no network calls: events are produced locally (visible with `LENS_DEBUG`) and are not sent to the statistics API yet.
- The statistics API has no authentication or rate limiting (ADR 0004 is Proposed): not for public deployment.
- Only the Python grammar is bundled: `signatures` and `expand_symbol` work for Python only.
- Remaining `npm audit` items need major upgrades: `zod` (production, connector) and the `vitest`/`vite` chain (dev only).

## Key results so far

| Result                             | Value                                     | Caveat                                                       |
| ---------------------------------- | ----------------------------------------- | ------------------------------------------------------------ |
| Python fixture, `light` saves      | 0.1%                                      | 8 synthetic files, cl100k estimate                           |
| Python fixture, `signatures` saves | 48.2% (short marker), 32.4% (long marker) | Per file, before `expand_symbol` calls; quality not measured |
| Agent adoption (unprompted)        | 0 of 6 runs                               | 1 agent, 3 tasks, tiny repo, one run per condition           |
| Agent told to use LENS             | 2 of 3 runs used it                       | 4 failed calls from wrong parameter name                     |
| SWE-bench Lite feasibility         | "Maybe"                                   | Dataset licence not found; needs 120 GB disk, 16 GB RAM      |
| Budget estimate (600 runs)         | about $63 to $492 depending on model      | Unsourced token assumptions; supervisor must decide who pays |

## Open decisions (owner)

1. Optional external LLM for history summaries, ADR 0005 (supervisor).
2. Models, providers, API budget and benchmark machine, ADR 0006 (supervisor).
3. npm package name and publishing account, ADR 0007.
4. Marker format and default level (team).
5. Accept ADRs that are already followed in practice (see `docs/adr/README.md`).

## Known documentation issues

- Proposal reference [6] (LeanCTX) still contains the placeholder "add the official URL".
- Savings numbers use an OpenAI tokenizer; say so wherever they are quoted.
- ADR 0010 has no reviewer yet.

## Risks an examiner may raise

- Net savings (after re-expansion) are unmeasured; per-file savings are not enough.
- No answer-quality measurement yet. T3 was not solved in either mode, but LENS was never called in Run 6 and neither run opened a file, so it says nothing about compression quality.
- One run per task cannot show a real difference; plan repeats.
- Benchmark is Python-only while LENS targets JS/TS.
