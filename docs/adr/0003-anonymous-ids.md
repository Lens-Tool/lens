# ADR 0003: How anonymous project and session IDs are generated

Status: Accepted (implemented in task S2-14)
Owner: Ahmed Mohamed Ahmed Yousry | Technical reviewer: Esraa Ahmed Abo-Elaas | Date: 2026-10-20

## Context

The statistics backend needs project and session IDs to group events, but the proposal forbids sending file paths, and project names or paths can reveal private information. The proposal does not say how the IDs are created.

## Options

1. Random UUID per project, generated once and stored locally; a new random session ID each time the connector starts.
2. Hash of the project path or folder name: stable without storage, but guessable and derived from private data.
3. Hash of the git remote URL: stable across machines, but reveals which repository is used if someone can guess the URL.

## Decision

Use option 1. The project ID is a random value (`proj_` followed by a UUID) stored in `<project folder>/.lens/project-id.json`. It is created once and read again on every later start. The session ID is random per connector start. IDs must match `[A-Za-z0-9_-]{8,64}`, as enforced by the privacy gate (`isAnonymousId` in `@lens/shared`).

Decided in S2-14:

- **Location:** inside the project folder, not a user-level config, so each project has its own ID. The folder is `LENS_PROJECT_ROOT` if set, otherwise the working directory of the connector process. The path is only used to find the file; it is never part of the ID.
- **Precedence:** a valid `LENS_PROJECT_ID` environment variable wins, then the file, then a new ID.
- **Unwritable folder:** the connector uses an ID for this session only and warns on stderr. Statistics from that run cannot be linked to earlier runs.
- **Corrupted or invalid file** (bad JSON, missing or invalid ID, a path instead of an ID): the connector warns on stderr and creates a new ID.
- **Warnings** are fixed messages without file paths.

## Consequences / open questions

- The same project on two machines gets two IDs (acceptable for the dashboard, can be revisited).
- Deleting the local file creates a new project identity.
- Users should add `.lens/` to the `.gitignore` of their own project, or the ID file may be committed and shared by the whole team.
- The working directory is only a default: if an agent starts the connector from another folder, set `LENS_PROJECT_ROOT`.
- Two connectors started for the same new project at the same moment can create two IDs; the last one saved wins and later runs are stable.
- Not an absolute guarantee of anonymity; the dashboard should say so.
