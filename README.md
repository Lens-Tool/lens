# LENS

![CI](https://github.com/Lens-Tool/lens/actions/workflows/ci.yml/badge.svg)

A task-aware, token-efficient context tool for AI coding agents. LENS runs locally as an MCP server, gives a coding agent only the code a task needs, and reports anonymous token/cost savings (energy/CO2 second) to a dashboard. Source code, prompt text and file paths never leave the developer's machine.

**Status:** Sprint 1 foundation. Implemented: monorepo tooling, `read_file_compressed` MCP tool with **AST-based `signatures` level for Python** (plus `light` baseline), a privacy-gated `UsageEvent`, `expand_symbol` for body recovery, and a minimal statistics API. Everything else is planned in `docs/`.

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
