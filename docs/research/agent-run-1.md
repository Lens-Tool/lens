# Agent run 1: coding tasks with and without LENS

Date: 2026-11-22
Agent: Claude Code 2.1.330 (one agent for all runs)
Model: claude-opus-5-5 (same for all runs)
LENS: commit 2bb44bd, tools available: `read_file_compressed` (default level `light`), `expand_symbol`
Sample repo: copy of `fixtures/python-repo` (8 files, 871 lines), tests: `python -m unittest -q test_auth` (16 tests, pass at baseline)
Token source: the agent's `/cost` screen at the end of each session (uncached input, cache read, cache write, output, estimated cost, requests)

This is a first look at adoption, not a study. See "Limits of this data" at the end.

The six numbered runs are the main data. Three extra runs, in which the agent was told to use LENS, are reported separately after them.

## Method

- Each task was run twice in a fresh session with one prompt per session: once with no LENS server connected, once with LENS connected.
- The prompt was identical in both runs of a pair (pasted from a text file) and never mentioned LENS, so the table shows whether the agent chose the tool by itself.
- The sample repo was reset to its baseline commit after every run (`git checkout -- .` and `git clean -fd`).
- Run order was R1 T1 no LENS, R2 T1 LENS, R3 T2 LENS, R4 T2 no LENS, R5 T3 no LENS, R6 T3 LENS, so the mode that goes first alternates between tasks.
- LENS was added with `claude mcp add` (local scope, run from the sample repo, project root set to the sample repo, debug logging on) and removed with `claude mcp remove` for the no-LENS runs. Nothing else was changed in the agent's settings between runs.
- Connection check: in Runs 2, 3 and 6, `/mcp` was checked at the start of the session and listed lens as connected with 2 tools. In Runs 4 and 5, `/mcp` showed no servers loaded. Where `/context` was recorded, it counted 4 MCP tools with LENS and 2 without; the 2 that remain are the agent's IDE integration tools.
- The commands run before the prompt were not identical across runs (`/context` only, `/mcp` and `/context`, or `/context` and `/context all`; in Run 5 they were run after the answer). The conversation already held 5 to 392 tokens at the prompt in Runs 2, 3, 4 and 6.
- Token record: total input is uncached input plus cache read plus cache write, with output tokens kept separate. Cost is the main number because cached tokens are priced differently. Wall time was not used.
- LENS debug logging (`LENS_DEBUG=true`) was on but was not used as evidence. "No LENS call" rests on the tool calls shown in the session.
- Solved was checked with `git diff --stat` and the unit tests for T1 and T2, and against the list of call sites for T3.
- After the six runs, three extra runs (E1 to E3) were done with one sentence added to the frozen prompt. They are described in their own section and are not part of the six.

Two attempts were discarded and are not in the results table:

- A first T1 attempt used the prompt "Sessions in this project currently expire after 45 minutes. Change them to expire after 2 hours". The agent read it as a question about its own settings, loaded its configuration skill, never opened a code file and asked a question. The question was not answered. All prompts were then reworded to start with "In the Python code of this project", and all six runs use the new wording.
- A first attempt at Run 2 was replaced because the lens connection could not be confirmed in that session. It made no LENS call: 108.0k input in total (37.9k uncached plus 70.1k cache read, 0 cache write), 814 output tokens, $0.1817, 5 requests. It is reported here so the replacement is not chosen for its numbers.

## Tasks

| Task | Prompt (exact text)                                                                                                                                                         | Counts as solved when                                                                                            |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| T1   | In the Python code of this project, user sessions expire after 45 minutes. Change the code so they expire after 2 hours.                                                    | Only `SESSION_DURATION_MINUTES` in `auth.py` changes, to 120; nothing unrelated changes; the 16 tests pass       |
| T2   | In the Python code of this project, add an optional phone number field to the User model. It should be None by default and appear in the dictionary that to_dict() returns. | `User` gets a phone field that defaults to None and is included in `to_dict()`; the tests pass                   |
| T3   | In the Python code of this project, which functions call generate_identifier? List each call site as file, line and the function it is in. Do not change any code.          | The answer lists all 5 call sites with the correct file, line and enclosing function (below) and no file changes |

Notes on the criteria:

- T2: the criterion was first written with the field name `phone`. The prompt does not name the field, so any clearly named phone field counts. This was decided after Run 3 and applied to Runs 3 and 4, which both chose `phone_number`.
- T3 call sites: `auth.py:21` `Session.__init__`, `auth.py:60` `AuthenticationService.register`, `database.py:37` `InMemoryDatabase.insert`, `services.py:94` `UserService._record_event`, `services.py:115` `NotificationService.send`. File, line and function were scored separately, against a `git grep` of the class, def and call lines in the sample repo.

## Results

Tokens are the numbers the agent reported: total input (uncached plus cache read plus cache write), output and estimated cost, rounded as shown on the `/cost` screen.

| Run | Task | LENS | LENS tool called? | Tokens (agent)               | Solved? | Notes                                                                                                                       |
| --- | ---- | ---- | ----------------- | ---------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1   | T1   | no   | -                 | 109.4k in, 875 out, $0.1888  | yes     | 5 requests; search x2, read x2, edit x1                                                                                     |
| 2   | T1   | yes  | no (0 calls)      | 201.1k in, 1.2k out, $0.2610 | yes     | 9 requests; also read the test file, re-read `auth.py` and ran the tests; `pytest` was not installed, retried with unittest |
| 3   | T2   | yes  | no (0 calls)      | 133.4k in, 1.4k out, $0.2460 | yes     | 6 requests; search x1, read x2, edit x2; field named `phone_number`                                                         |
| 4   | T2   | no   | -                 | 137.0k in, 1.3k out, $0.1746 | yes     | 6 requests; same tool pattern and same edits as Run 3                                                                       |
| 5   | T3   | no   | -                 | 68.4k in, 583 out, $0.1855   | no      | 3 requests; search x2, no file read; file and line right for 5 of 5 sites, function right for 0 of 5                        |
| 6   | T3   | yes  | no (0 calls)      | 91.8k in, 755 out, $0.0657   | no      | 4 requests; search x3, no file read; same score as Run 5, with some different wrong function names                          |

Token detail:

| Run | Uncached input | Cache read | Cache write | Output | Cost    | Requests |
| --- | -------------- | ---------- | ----------- | ------ | ------- | -------- |
| 1   | 39.3k          | 70.1k      | 0           | 875    | $0.1888 | 5        |
| 2   | 52.0k          | 149.1k     | 0           | 1.2k   | $0.2610 | 9        |
| 3   | 50.1k          | 83.3k      | 0           | 1.4k   | $0.2460 | 6        |
| 4   | 31.8k          | 105.2k     | 0           | 1.3k   | $0.1746 | 6        |
| 5   | 42.1k          | 26.3k      | 0           | 583    | $0.1855 | 3        |
| 6   | 8.5k           | 83.3k      | 0           | 755    | $0.0657 | 4        |

## Extra runs (agent told to use LENS)

After the six runs, three extra runs were done, one per task, with LENS connected. The only change was one sentence appended to the frozen prompt: "Use the lens tools read_file_compressed and expand_symbol to read the code." These runs are not part of the six. They answer a different question: what happens when the agent is told to use LENS, not whether it chooses to.

- The protocol was the same as for the six runs: fresh session, one prompt, `/context all` before the prompt, repo reset afterwards.
- In E1 and E3 the sentence was typed without a space after the previous full stop.
- The three runs were done back to back, a few minutes apart, so the cache may have been warm at the start of E2 and E3.
- "LENS calls" counts every call to a lens tool, including failed ones. Lines in the T3 answer are scored exact, so a line marked as approximate does not count as correct.

| Run | Task | LENS calls               | Tokens (agent)               | Solved? | Notes                                                                                                                                                                                     |
| --- | ---- | ------------------------ | ---------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | T1   | 0                        | 151.7k in, 880 out, $0.1744  | yes     | 7 requests; search x2, read x2, edit x1; the agent restated the instruction in its reasoning but used its own read tool                                                                   |
| E2  | T2   | 3, all succeeded         | 177.7k in, 1.7k out, $0.2294 | yes     | 8 requests; search x1, `read_file_compressed` x1 (level `signatures`), `expand_symbol` x2, edit x2 with the agent's own edit tool; field named `phone_number`                             |
| E3  | T3   | 8: 4 failed, 4 succeeded | 118.7k in, 1.5k out, $0.1384 | no      | 5 requests; search x1, `read_file_compressed` x8 (default level), `expand_symbol` x0; file and function right for 5 of 5 sites, line right for 0 of 5 (the answer gave approximate lines) |

Token detail:

| Run | Uncached input | Cache read | Cache write | Output | Cost    | Requests |
| --- | -------------- | ---------- | ----------- | ------ | ------- | -------- |
| E1  | 33.3k          | 118.4k     | 0           | 880    | $0.1744 | 7        |
| E2  | 41.8k          | 135.9k     | 0           | 1.7k   | $0.2294 | 8        |
| E3  | 22.3k          | 96.4k      | 0           | 1.5k   | $0.1384 | 5        |

LENS call detail:

- E2: the first call read the model file at level `signatures`, a level the agent chose itself. `expand_symbol` for the `User` class returned the class in full (lines 10 to 94 of a 119-line file). After editing, `expand_symbol` for `User` was called again to check the result (lines 10 to 97).
- E3: the first four calls (`auth.py`, `services.py`, `utils.py`, `database.py`) used the parameter name `file_path` and all failed with MCP error -32602, because the required parameter `path` was missing. The failure text said the tool's input schema had not been in the prompt when the call was made. The agent then called the tool again for the same four files with `path` and no level (so `light`), without loading the tool first, and all four succeeded. Its answer gave lines ~32, ~65, ~101, ~116 and ~29, against actual lines 21, 60, 94, 115 and 37.

## Observations

Runs 1 to 6 (agent not told to use LENS):

- **No LENS call in any run with LENS (Runs 2, 3, 6).** Lens was connected and listed as available, but the agent used only its own tools (search, read, edit, shell). Its first call in every run was its own search. In Run 6, the agent made three searches and no step to look up or load a lens tool. `/context` listed the MCP tools as "loaded on-demand" when lens was connected (Runs 2, 3, 6), and the runs do not show whether the agent saw the tool names at the start.
- **The paired differences in tokens and cost cannot be attributed to LENS.** With no LENS call in any pair, the with-LENS run cost more in T1 (Run 2 $0.2610 against Run 1 $0.1888) and in T2 (Run 3 $0.2460 against Run 4 $0.1746), and less in T3 (Run 6 $0.0657 against Run 5 $0.1855). Total input went from 109.4k to 201.1k in T1, from 137.0k to 133.4k in T2 and from 68.4k to 91.8k in T3. The direction changes between pairs.
- **The same prompt gave very different amounts of work.** In T1, Run 1 took 5 requests and Run 2 took 9, with no LENS call in either. Run 2 also read the test file, re-read `auth.py` and ran the tests, which Run 1 did not. No cell was repeated under identical conditions, so the size of the run-to-run noise is not measured.
- **Within the six runs, cost followed uncached input more closely than total input.** Ordered by uncached input the runs are 6, 4, 1, 5, 3, 2, and ordered by cost they are 6, 4, 5, 1, 3, 2 (Runs 1 and 5 are $0.0033 apart). The fit is loose across all nine runs: E2 had slightly less uncached input than Run 5 but cost $0.0439 more, with more cache read and more output. Prices were not checked here.
- **Cache state was not controlled.** All nine runs report 0 cache write, and uncached input ranged from 8.5k (Run 6) to 52.0k (Run 2).
- **T1 and T2 were solved in all four runs with minimal diffs.** The T1 diff was one line in `auth.py` (Runs 1 and 2). The T2 diff was 3 lines in `models.py`, and the two T2 runs made identical edits (Runs 3 and 4). In Runs 2, 3 and 4 the agent read whole small files with its own tool (62 to 156 lines each), and in both T2 runs it read `models.py` with its own tool before editing it.
- **T3 was not solved in either mode.** Both answers had the right file and line for all 5 call sites and none of the function names was right (Runs 5 and 6). Neither agent opened a source file. Their search results showed matching lines but not enclosing functions, and the names they gave do not exist in the files. In Run 6, three of the five wrong names differed from those in Run 5.
- **T3 had the smallest inputs and was the only task not solved.** Run 5 (68.4k) and Run 6 (91.8k) were below Runs 1 to 4 in total input, so total tokens alone would have made these runs look best.

Extra runs E1 to E3 (agent told to use LENS), one run each:

- **The agent called a LENS tool in 2 of 3 runs (E2, E3) and ignored the instruction in E1.** In E1 it restated the instruction in its reasoning and then used its own search and read tools for the whole task. The runs do not show why. Calls per run were 0, 3 and 8, and the 8 in E3 include 4 failures.
- **E3's failures came from a parameter name.** Four calls with `file_path` failed and the same calls with `path` worked. In E2 the first call already used `path`, so one of the two sessions that used the tool guessed the name wrong.
- **When the agent used LENS results, it did not re-read the same files with its own read tool (E2, E3).** In E2 the agent's own edit tool edited `models.py` successfully although the agent had read that file only through LENS. In Runs 3 and 4 the agent read it with its own tool first, so those runs could not show whether that read was needed.
- **The `light` level returned no line numbers, and every line in the E3 answer was wrong.** E3 is the only T3 run with all five function names right (Runs 5 and 6 had 0 of 5), but it had 0 of 5 lines. The search-based answers in Runs 5 and 6 had the right lines and no names. The two sources are complementary, and the agent used only one per run.
- **E2's `signatures` read plus two `expand_symbol` calls returned most of the file twice.** The `User` class is 85 of the file's 119 lines. This is one run, and the agent chose that sequence.
- **Token and cost differences in the extra runs are not consistent with a LENS effect.** E1 made no LENS call and was the cheapest T1 run ($0.1744 against $0.1888 and $0.2610). E2 had more total input than both T2 runs (177.7k against 133.4k and 137.0k) and a cost between them. E3 had more total input than both T3 runs (118.7k against 68.4k and 91.8k) and a cost between them ($0.1384 against $0.0657 and $0.1855). The prompts differ from the six runs, so these are not pairs.

Not observed: whether a different tool description would make the agent call the tools unprompted, and whether using the tools changes cost reliably (this needs repeats of the same condition).

## What would make the agent use the tool more

These are hypotheses to test in a later run, not results.

1. **Tool description: say when to prefer the tool.** The `read_file_compressed` description lists levels and behaviour, and the agent never called either tool by itself (Runs 2, 3, 6). E1 shows that one sentence in the prompt did not always make the agent use it either, so this is the least certain of the three. A first sentence that says when to use the tool instead of a plain file read is the change to test.
2. **Parameter name: accept `file_path` as well as `path`.** In E3 the first four calls failed because the agent used `file_path` and the schema requires `path`. The agent's own read tool probably names this parameter `file_path` (not checked here), so an alias would avoid failed calls like these.
3. **Default output: keep the original line numbers at the `light` level.** In E3 the results had no line numbers and every line in the answer was wrong, while `signatures` keeps the original ranges in its markers (`# L8-11`). Original line numbers in the `light` output, or a note that lines have shifted, would let an agent answer "file, line and function" from one call. Separately, `docs/research/python-savings.md` shows `light` saved 0.7% on this repo and `signatures` 57.8%, so `signatures` as the default for Python is worth testing, but E2 shows it can lead to expanding most of a small file.

## Limits of this data

- One agent, one model, three tasks, one run per task and mode: 6 runs in total, plus 3 extra runs (one per task) in which the agent was told to use LENS.
- A language model can give a different answer, different tool choices and different token counts when the same run is repeated, so a single pair cannot show a real difference. Run 1 and Run 2 differ by 4 requests with no LENS call in either.
- The sample repo is small and synthetic, so the agent can read whole files cheaply and LENS has little to save.
- The agent-reported token numbers include things LENS cannot change, such as the agent's own system prompt, tool definitions and skills, which were about 12.6k tokens at session start in `/context`.
- Cache state was not controlled and start times were not recorded the same way for every run. The `/cost` screen's percentage of input from cache did not match the raw counts in several runs (for example Run 3: 74% on screen, about 62% from the counts), so only the raw counts are used.
- The commands run before the prompt were not identical across runs, and the T2 solved criterion was widened after Run 3.
- The extra runs tell the agent to use LENS, so they show what happens when it uses the tools and not whether it chooses to. Their prompts differ from the frozen ones, so they cannot be compared with the six runs as pairs. There is one run per task and no repeat. The E3 failures happened in one session, and E2 had none. The sentence was typed without a space in E1 and E3.
- The numbers show what happened in these runs. They do not show what would happen in general.
