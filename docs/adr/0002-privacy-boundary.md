# ADR 0002: Privacy boundary between the local connector and the cloud

Status: Proposed
Owner: Ahmed Mohamed Ahmed Yousry | Technical reviewer: Abdallah Elwasify | Date: 2026-10-20

## Context

The proposal states that code, prompt text and file paths never leave the developer's machine, and that the cloud receives only anonymous statistics (token counts, costs, tool names, timings, project and session IDs).

## Options

1. Convention only: developers promise not to send private data. Easy, but one mistake leaks data.
2. Deny-list: reject known bad fields such as `filePath`. New private fields could still slip through.
3. Allow-list: one `UsageEvent` type, with every other field rejected by the sender and the API.

## Decision

Use the allow-list. `UsageEvent` in `@lens/shared` is the only type that may be sent to the cloud, and `parseUsageEvent` rejects anything else. Error messages and logs sent off the machine must not contain paths or code.

## Consequences / open questions

- Adding a new statistic requires a reviewed change to `@lens/shared` (2 approvals).
- ID rules are in ADR 0003.
- Task S1-07 threat-models the gate (leaks via IDs, errors, logs, URLs).
