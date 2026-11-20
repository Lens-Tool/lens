# LENS architecture (Sprint 1 baseline)

Source of truth: the graduation project proposal (12 Oct 2026). Items marked _(recommendation)_ are not in the proposal.

```mermaid
flowchart LR
  Agent[Coding Agent] -- MCP stdio --> Conn
  subgraph Local["Developer machine (code, prompts, paths stay here)"]
    Conn[Lens Connector / MCP tools]
    TC[Task & Context]
    AST[AST Compressor]
    Cache[Cache / Diff / Session]
    Hist[History & tool-output]
    Sec[Redaction + Token budget]
    Conn --> TC --> AST --> Cache --> Sec
    Conn --> Hist
  end
  Conn -- "anonymous UsageEvent only (HTTPS)" --> API[Statistics API]
  subgraph Cloud
    API --> PG[(PostgreSQL)]
    API --> RD[(Redis)]
    PG --> Dash[Dashboard: Next.js + Recharts]
  end
```

```mermaid
flowchart TD
  shared[shared: types, errors, privacy gate] --> compression
  shared --> task-context
  shared --> stats-api
  compression --> connector
  task-context --> connector
  stats-api --> dashboard
  connector -. events .-> stats-api
  connector --> evaluation
```

Boundary rules: only `@lens/shared` is imported by every package; `UsageEvent` is the only data that crosses to the cloud; `parseUsageEvent` is the allow-list gate on both sender and receiver.

## AST compressor: syntax-error fallback (S2-07)

Real files are messy. The compressor must never crash and must never hide code because the parser failed.

**Rule:** if the parse tree sets `hasSyntaxError`, return the file **unchanged** with `level: 'raw'` and a `warning` on `CompressResult`. Do not extract symbols or strip bodies from a broken tree. A parser problem is not a reason to omit source — the agent still needs the original text.

Valid trees continue to the signatures renderer as usual. Callers must still dispose parse trees (`ParsedFile.dispose` / `withParsedFile`) so WASM memory is released after each file.
