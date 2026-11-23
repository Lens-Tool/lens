# Benchmark feasibility (S2-16)

## Verdict

**Maybe** - SWE-bench Lite fits our ablation design but the dataset licence is unpublished and we must confirm redistribution rights before publishing results.

## How a SWE-bench task works

Each instance provides: `repo` (e.g., `django/django`), `base_commit` (pre-fix commit), `problem_statement` (GitHub issue text), `FAIL_TO_PASS` (tests that fail before the fix and must pass after), `PASS_TO_PASS` (tests that pass before and must still pass), and the gold `patch` [SWE-bench datasets guide](https://www.swebench.com/SWE-bench/guides/datasets/). Evaluation: apply the predicted patch to `base_commit` in a Docker container, run the test suite; pass = all FAIL_TO_PASS pass **and** all PASS_TO_PASS still pass [Harness reference](https://www.swebench.com/SWE-bench/reference/harness/).

## Size and Python coverage

- **Full**: 2,294 instances across 12 Python repos [datasets guide](https://www.swebench.com/SWE-bench/guides/datasets/)
- **Lite**: 300 test + 23 dev instances, 11 of the 12 repos [lite.html](https://www.swebench.com/lite.html)
- **Verified**: 500 human-filtered instances [verified.html](https://www.swebench.com/verified.html)
- **Python-only**; LENS also targets JS/TS - a separate benchmark would be needed for those.
- Per-repo counts for Lite and Verified are **not published as text** (Lite shows only a pie chart; Verified has no breakdown) [lite.html](https://www.swebench.com/lite.html), [verified.html](https://www.swebench.com/verified.html). We would compute them by loading the HF dataset splits.

## Infrastructure

- **120 GB free disk**, 16 GB RAM, 8+ CPU cores recommended; x86_64 preferred [Docker setup](https://www.swebench.com/SWE-bench/guides/docker_setup/)
- Windows: Docker Desktop + WSL2; macOS: Docker Desktop; ARM64 is "experimental - build locally" [Docker setup](https://www.swebench.com/SWE-bench/guides/docker_setup/)
- Per-repo size, LOC, test runtime, and per-image Docker size are **not verified** (only aggregate cache tiers published: ~100 GB env, ~2 TB instance) [Docker setup](https://www.swebench.com/SWE-bench/guides/docker_setup/)
- Lite (300 instances) on 16-core/12 workers: ~30 min with env cache [Harness reference](https://www.swebench.com/SWE-bench/reference/harness/)

## Licences

- **Harness code**: MIT (2023, Carlos E Jimenez et al.) [raw LICENSE](https://raw.githubusercontent.com/SWE-bench/SWE-bench/main/LICENSE)
- **Dataset (2,294 task instances)**: **no licence found** on the Hugging Face card, FAQ, or GitHub repo [HF dataset card](https://huggingface.co/datasets/SWE-bench/SWE-bench), [FAQ](https://www.swebench.com/SWE-bench/faq/)
- **Individual repos**: various (BSD-3, MIT, Apache-2, PSF) - **not verified** per repo
- **Our plan**: store only `instance_id` strings (e.g., `django__django-12345`) and fetch task data at run time. This also follows CONTRIBUTING.md, Privacy rule section (source code, prompts, and file paths never leave the machine; only `UsageEvent` goes to cloud) [CONTRIBUTING.md](../../CONTRIBUTING.md). We should confirm redistribution rights with the SWE-bench authors before publishing anything that includes task data.

## Rough cost (estimates)

**Token assumptions (not sourced):** 150 k uncached input, 100 k cache read, 10 k output per task-run.  
**Scope:** 1 task, and 600 runs (50 tasks x 4 conditions x 3 repeats).  
Pricing from [Anthropic](https://platform.claude.com/docs/en/about-claude/pricing) and [OpenAI](https://developers.openai.com/api/docs/pricing).

| Model                              | Input / MTok | Cache read / MTok | Output / MTok | 1 task     | 600 runs   |
| ---------------------------------- | ------------ | ----------------- | ------------- | ---------- | ---------- |
| Claude Opus 5.5                    | $4.00        | $0.20             | $20.00        | $0.82      | $492.00    |
| Claude Sonnet 5.5                  | $2.00        | $0.10             | $10.00        | $0.41      | $246.00    |
| **Claude Haiku 5.5 (>100 k tier)** | **$0.50**    | **$0.05**         | **$2.50**     | **$0.105** | **$63.00** |
| gpt-4o                             | $2.50        | $1.25             | $10.00        | $0.60      | $360.00    |
| gpt-4o-mini                        | $0.15        | $0.075            | $0.60         | $0.036     | $21.60     |

_Arithmetic check (Haiku >100k): 150k x $0.50/1M = $0.075; 100k x $0.05/1M = $0.005; 10k x $2.50/1M = $0.025; sum = $0.105. 600 x $0.105 = $63.00._

Prices were read from the vendor pricing pages and not independently re-checked.

Warning: All figures are **estimates**; actual tokens vary by agent design, repo, retries [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing).

## Who runs what

Proposal (per ADR 0006 option 3): **scripted loop** for the main numbers on one machine that meets the Docker requirements; **small manual run** in a real agent (Claude Code / Cursor) for adoption signals. Rationale: agent-run-1.md showed the agent made **0 unprompted LENS calls** across 6 runs [agent-run-1.md](agent-run-1.md), so a scripted loop that explicitly invokes the tools is needed to measure the ablation conditions.

## Not verified

- Per-repo task counts for Lite (300) and Verified (500)
- Per-repo Docker image sizes, LOC, test runtimes
- SWE-bench dataset licence (none found; should confirm with the authors)
- Windows ARM64 / macOS ARM64 pre-built Docker images ("experimental - build locally" only)

## Next question

**For Dr. Gaber Hassan:** Which models and providers do we use, who covers the API budget, and which machine (meeting the 120 GB / 16 GB / 8-core Docker requirements) runs the harness?
