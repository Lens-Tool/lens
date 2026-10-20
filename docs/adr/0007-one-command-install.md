# ADR 0007: What "one command" installation means

Status: Proposed
Owner: Esraa Ahmed Abo-Elaas | Technical reviewer: Aya Saad Rizk | Date: 2026-10-20

## Context

The proposal says developers add Lens to their agent with a single command and that the connector is published on npm. It does not define the command or which agents are supported first.

## Options

1. Published npm package run through `npx`; the user adds one short entry to the agent's MCP configuration (or uses the agent's own "add MCP server" command).
2. A Lens `init` command that detects the agent and writes its configuration file.
3. A downloadable installer script.

## Decision

Start with option 1 and document the exact command and configuration for each supported agent. Add the `init` command (option 2) once option 1 works. Avoid installer scripts that run unreviewed code.

## Consequences / open questions

- Needs a free npm package name and a publishing account (the supervisor should know whose account is used).
- Supported agents for the first release: to be chosen in task S1-10.
- The proposal lists a CLI as future work, so `init` may stay small.
