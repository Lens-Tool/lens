# ADR 0001: Package manager, workspaces and Node.js version

Status: Proposed
Owner: Lama Hany Shaker | Technical reviewer: Esraa Ahmed Abo-Elaas | Date: 2026-10-20

## Context

The proposal requires Node.js with TypeScript throughout but does not name a package manager, a monorepo tool or a Node version. Seven students on mixed operating systems need one setup that works everywhere with the fewest extra tools.

## Options

1. npm workspaces: installed with Node, nothing extra to learn, works on Windows, macOS and Linux.
2. pnpm workspaces: faster installs and stricter dependencies, but one more tool for everyone to install.
3. Yarn or Turborepo/Nx: more features than a project of this size needs.

## Decision

Use npm workspaces with TypeScript project references (`tsc -b`), Vitest for tests, ESM modules, and Node.js 22 LTS (pinned in `.nvmrc` and `engines`). Revisit pnpm only if install time becomes a real problem.

## Consequences / open questions

- Everyone installs Node 22 (nvm-windows users run `nvm use 22`, since it does not read `.nvmrc`).
- Native modules such as tree-sitter must be tested on all operating systems (task S1-08).
- No supervisor approval needed.
