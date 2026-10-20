# ADR 0003: How anonymous project and session IDs are generated

Status: Proposed
Owner: Ahmed Mohamed Ahmed Yousry | Technical reviewer: Esraa Ahmed Abo-Elaas | Date: 2026-10-20

## Context

The statistics backend needs project and session IDs to group events, but the proposal forbids sending file paths, and project names or paths can reveal private information. The proposal does not say how the IDs are created.

## Options

1. Random UUID per project, generated once and stored locally; a new random session ID each time the connector starts.
2. Hash of the project path or folder name: stable without storage, but guessable and derived from private data.
3. Hash of the git remote URL: stable across machines, but reveals which repository is used if someone can guess the URL.

## Decision

Use option 1. The project ID is a random value stored in a local config file (location to be agreed: user-level config or a `.lens/` folder that is git-ignored). The session ID is random per connector start. IDs must match `[A-Za-z0-9_-]{8,64}` as enforced by the privacy gate.

## Consequences / open questions

- The same project on two machines gets two IDs (acceptable for the dashboard, can be revisited).
- Deleting the local file creates a new project identity.
- Not an absolute guarantee of anonymity; the dashboard should say so.
