# ADR 0008: Git branching strategy (`develop` and `main`, merge commits)

Status: Proposed
Owner: Esraa Ahmed Abo-Elaas | Technical reviewer: Abdallah Elwasify | Date: 2026-10-22

## Context

Seven students will work in parallel. The team wants day-to-day work to land on an integration branch before reaching the stable branch, and does not want squash merging.

## Options

1. Trunk-based: short branches into `main`, squash merge. Simplest, fewer branches.
2. `develop` plus `main`: features go into `develop`, releases go into `main`, merge commits only.
3. Full Git Flow with release and hotfix branches: too heavy for this team.

## Decision

Use option 2. Feature branches start from `develop`; releases are PRs from `develop` to `main` at the end of each sprint. Squash and rebase merges are disabled; both branches are protected by rulesets requiring a PR, one approval and passing CI.

## Consequences / open questions

- History contains merge commits and every branch commit, so commit messages must stay clean.
- Two branches mean more places to forget a sync; `main` needs an occasional merge back into `develop`.
- The "PR into `main` must come from `develop`" rule is a team rule unless enforced with an extra CI check.
