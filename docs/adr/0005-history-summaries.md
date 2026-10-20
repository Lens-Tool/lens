# ADR 0005: How old conversation turns are summarized

Status: Proposed (needs supervisor input)
Owner: Amr Mohamed Abdelrahman | Technical reviewer: Ahmed Mohamed Ahmed Yousry | Date: 2026-10-20

## Context

The proposal turns old turns into a rolling summary and says any LLM call is counted in net savings. It does not say which model writes the summary. Sending history to an external LLM may send code-related text to a third-party provider, which affects the privacy goal.

## Options

1. Rule-based summaries with no LLM: keep errors, decisions and file names, drop repetition.
2. A small, cheap LLM through the user's own API key.
3. The same model and provider as the coding agent.

## Decision

Start with option 1 so the core feature never sends text to another provider. Add option 2 later as an opt-in setting, with its token cost subtracted from the reported savings and secrets redacted before the call.

## Consequences / open questions

- Needs Dr. Gaber Hassan's view: is an optional external LLM acceptable?
- Rule-based summaries may lose detail; the ablation study should measure that.
- Summary quality needs a test set (see ADR 0006).
