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
