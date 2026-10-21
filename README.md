![CI](https://github.com/Lens-Tool/lens/actions/workflows/ci.yml/badge.svg)

A task-aware, token-efficient context tool for AI coding agents. LENS runs locally as an MCP server, gives a coding agent only the code a task needs, and reports anonymous token/cost savings (energy/CO2 second) to a dashboard. Source code, prompt text and file paths never leave the developer's machine.

**Status:** Sprint 1 foundation. Implemented: monorepo tooling, a baseline `read_file_compressed` MCP tool (comment/blank-line stripping, not yet AST), a privacy-gated `UsageEvent`, and a minimal statistics API. Everything else is planned in `docs/`.

| Path                    | Purpose                                              |
| ----------------------- | ---------------------------------------------------- |
| `packages/shared`       | Shared types, `LensError`, privacy gate              |
| `packages/compression`  | Compression engine (baseline now, tree-sitter later) |
| `packages/task-context` | `prepare_task` contract (placeholder)                |
| `packages/connector`    | Local MCP server                                     |
| `apps/stats-api`        | Express statistics API                               |
| `apps/dashboard`        | Placeholder for Next.js dashboard                    |
| `evaluation`            | Placeholder for benchmark/ablation framework         |

Start with `docs/setup.md`, then `CONTRIBUTING.md` and `docs/architecture.md`.
