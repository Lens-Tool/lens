# ADR 0001: npm workspaces with TypeScript project references

Status: proposed (confirm in T01/T02). Context: seven students, mixed OS, no prior shared tooling. Decision: npm workspaces (no extra tool to install), `tsc -b` for builds, Vitest for tests, ESM everywhere. Alternative considered: pnpm (faster, stricter) - revisit if install time becomes a problem.
