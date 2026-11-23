# Glossary

| Term | Meaning in LENS |
| ---- | --------------- |
| MCP | Model Context Protocol. How a coding agent (Claude Code, Cursor, ...) calls tools exposed by a local server. LENS runs as an MCP server over stdio. |
| Connector | The local LENS process (`packages/connector`) started by the agent. Sees real project files; nothing private leaves the machine. |
| `UsageEvent` | The only data allowed to cross to the cloud: tool name, `tokensBefore`, `tokensAfter`, duration, timestamps, anonymous project and session IDs. |
| Privacy gate | `parseUsageEvent` in `@lens/shared`. Allow-list check on both sender and receiver; rejects any extra field. |
| `LensError` | Shared error type with a code. MCP tools return `isError: true` with `CODE: message`; the HTTP API returns `{ "error": { "code", "message" } }`. |
| Compression levels | `raw` (unchanged), `light` (comments and blank lines removed), `signatures` (function/method bodies replaced by a marker; imports, headers, docstrings kept). |
| Marker | The line that replaces an omitted body, for example `... # L8-11` (short) or the longer form naming `expand_symbol`. Final format not yet chosen. |
| Progressive disclosure | The agent gets signatures first and calls `expand_symbol` only when it needs a body. |
| `read_file_compressed` | MCP tool that returns a file at a chosen compression level. Implemented. |
| `expand_symbol` | MCP tool that returns the full body of one symbol. Implemented. |
| `prepare_task` | Planned MCP tool: classifies intent, selects relevant files/functions, returns a cleaned task statement. Contract only for now. |
| `search_code`, `get_summary` | Planned MCP tools listed in the proposal. |
| Task & Context Layer | Package `task-context`: intent classifier, context selection from the import/call graph, prompt cleaner, history compression, prompt-quality score, adaptive token budget. |
| Syntax-error fallback | If the parse tree has `hasSyntaxError`, return the file unchanged as `raw` with a warning (S2-07). |
| `TokenCounter` | Synchronous, never-throwing interface. `TiktokenCounter` (`cl100k_base`) with fallback to `ApproxTokenCounter` (about 4 chars per token). |
| `cl100k_base` | An OpenAI tokenizer encoding. Only an estimate for Claude and other models. |
| Net savings | Tokens saved minus tokens added back by `expand_symbol` calls and any LLM calls LENS makes itself. |
| Ablation study | Same agent and model under four conditions: raw, AST only, AST + task layer, all features. Compares success rate, quality, cost, latency and agent adoption of LENS. |
| Agent adoption | How often the agent actually calls LENS tools unprompted. In agent run 1 it was 0 of 6 runs. |
| SWE-bench Lite | 300 test instances (Python only); candidate benchmark. Dataset licence not found, so store only instance IDs. |
| ADR | Architecture Decision Record in `docs/adr`. |
| DoR / DoD | Definition of Ready / Definition of Done (`docs/conventions.md`). |
| S1-xx / S2-xx | Sprint 1 / Sprint 2 task IDs. ClickUp is the source of truth for status; GitHub for code and ADRs. |
