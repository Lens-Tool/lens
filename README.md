# LENS

![CI](https://github.com/Lens-Tool/lens/actions/workflows/ci.yml/badge.svg)

A task-aware, token-efficient context tool for AI coding agents. LENS runs locally as an MCP server, gives a coding agent only the code a task needs, and reports anonymous token/cost savings (energy/CO2 second) to a dashboard. Source code, prompt text and file paths never leave the developer's machine.

**Status:** Sprint 2 (Python compression). Implemented: monorepo tooling, `read_file_compressed` MCP tool with `light` and an AST-based `signatures` level for **Python only** (WASM tree-sitter, Python grammar only), `expand_symbol` for body recovery, a real token counter (`js-tiktoken`, `cl100k_base`: an estimate for Claude), anonymous project and session IDs, a privacy-gated `UsageEvent`, and a minimal statistics API with PostgreSQL.

**Not implemented yet:** JavaScript/TypeScript `signatures`, secrets redaction (secrets pass through unchanged), the Task & Context Layer (`prepare_task`), cache and diff, history compression, the dashboard, and sending events from the connector to the statistics API (the connector makes no network calls). The statistics API has no authentication or rate limiting: do not expose it publicly. See `docs/STATUS.md`.

| Path                    | Purpose                                                    | Status                |
| ----------------------- | ---------------------------------------------------------- | --------------------- |
| `packages/shared`       | Shared types, `LensError`, privacy gate                    | Implemented           |
| `packages/compression`  | Compression engine (signatures level for Python)           | Implemented           |
| `packages/task-context` | `prepare_task` contract                                    | Placeholder           |
| `packages/connector`    | Local MCP server (`read_file_compressed`, `expand_symbol`) | Implemented           |
| `apps/stats-api`        | Express statistics API                                     | Implemented (minimal) |
| `apps/dashboard`        | Next.js dashboard                                          | Placeholder           |
| `evaluation`            | Benchmark/ablation framework                               | Placeholder           |

See [`docs/compression.md`](docs/compression.md) for the Python compression pipeline reference.

Start with `docs/setup.md`, then `CONTRIBUTING.md` and `docs/architecture.md`.
