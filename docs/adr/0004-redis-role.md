# ADR 0004: Role of Redis in the backend

Status: Proposed
Owner: Abdallah Elwasify | Technical reviewer: Ahmed Mohamed Ahmed Yousry | Date: 2026-10-20

## Context

The proposal lists Redis in the backend stack but does not say what it is used for. PostgreSQL already stores the statistics.

## Options

1. Rate limiting and abuse protection on the statistics API.
2. Caching dashboard aggregates (totals per project, per day).
3. A job queue for background aggregation.
4. Do not use Redis until a real need appears.

## Decision

Use Redis for rate limiting on `POST /v1/events` and for caching dashboard aggregates; PostgreSQL stays the source of truth. A job queue is not needed at this scale. If no real need appears by the backend sprint, drop Redis rather than keep it for show.

## Consequences / open questions

- Redis only ever holds anonymous aggregates and counters.
- The local file cache in the connector (content hashes, diffs) is separate and does not use Redis.
- Hosting on Render or Railway adds a Redis service; check the free-tier limits.
