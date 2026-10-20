# ADR 0006: Agents and models used for the ablation study

Status: Proposed (needs supervisor input)
Owner: Abdallah Mohamed Ramdan | Technical reviewer: Lama Hany Shaker | Date: 2026-10-20

## Context

The proposal runs a SWE-bench-style benchmark with the same agent and model under four conditions (raw files, AST only, AST + task layer, all features), using the Claude and OpenAI APIs, and also measures how often the agent calls Lens. It does not name the agent, the models, the task set or who pays for API usage.

## Options

1. A scripted agent loop that we write, calling an API model with Lens tools: repeatable, cheaper to control, but not a real product.
2. A real agent (Claude Code or Cursor) driven by hand: realistic, but slow and hard to repeat.
3. Scripted loop for the main numbers plus a small manual run in a real agent for adoption.

## Decision

Use option 3. The model name and version are pinned and recorded for every run, with the same task set across conditions. The task set and sample repositories come from task S1-14.

## Consequences / open questions

- Needs Dr. Gaber Hassan: which models and providers, and who covers the API budget?
- Non-determinism means repeated runs per task; the count depends on budget.
- API keys stay in `.env` and are never committed.
