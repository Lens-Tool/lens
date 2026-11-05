# Python fixture token savings

Date: 2026-11-05
Token counter: approx-chars-div-4 (rough estimate, about 4 characters per token; not a real tokenizer)
Fixture: fixtures/python-repo (8 files)

Levels compared: raw (original source), light (`compressLight`: comments and blank lines removed), and signatures (function and method bodies removed using the extracted symbol ranges; imports, variables, class and function headers kept). Percentages are tokens saved relative to raw.

The signatures level is an **approximation** built by `scripts/report-savings.ts` until the real renderer (S2-06) is merged. It is shown three ways: with no placeholder (an upper bound that real output cannot reach), with a short marker, and with a long marker that names the function.

## Summary

| Level                                                                          | Tokens | Saved |
| ------------------------------------------------------------------------------ | -----: | ----: |
| Raw (original source)                                                          |   6568 |     - |
| Light (comments and blank lines removed)                                       |   6520 |  0.7% |
| Signatures, no placeholder (upper bound, cannot be reached)                    |   2238 | 65.9% |
| Signatures, short marker `...  # L8-11`                                        |   2754 | 58.1% |
| Signatures, long marker `...  # lens: lines 8-11 omitted (expand_symbol name)` |   4267 | 35.0% |

## Findings

- The light level saves only 0.7%: comments and blank lines are a very small part of the tokens.
- Almost all the savings come from omitting function and method bodies, which is also the level that risks answer quality (not measured yet).
- The no-placeholder figure (65.9%) is an upper bound that real output cannot reach: every omitted body must leave a marker so the agent knows something is missing.
- Omitting a body removes about 46 tokens on average, so the size of the marker decides the result. A short marker costs about 5.4 tokens per body and a long marker about 21.4. The long marker also repeats the function name that is already on the line above it.
- With the short marker the signatures level saves 58.1%; with the long marker, 35.0%.
- The fixture is synthetic, so these percentages describe the fixture and not real projects. Real functions are usually longer, which would increase the savings, but that is not measured.

## Per file

Columns with "%" values show the tokens saved relative to raw.

| File         | Raw tokens | Light | Light saved | Signatures, no placeholder (upper bound) | Signatures, short marker | Signatures, long marker | Symbols | Bodies omitted |
| ------------ | ---------: | ----: | ----------: | ---------------------------------------: | -----------------------: | ----------------------: | ------: | -------------: |
| auth.py      |        915 |   908 |        0.8% |                                    72.1% |                    66.0% |                   48.7% |      21 |             10 |
| cli.py       |        729 |   724 |        0.7% |                                    73.9% |                    67.6% |                   51.3% |      18 |              9 |
| config.py    |        401 |   396 |        1.2% |                                    61.3% |                    52.1% |                   29.7% |      12 |              7 |
| database.py  |        726 |   721 |        0.7% |                                    63.4% |                    54.3% |                   28.8% |      18 |             12 |
| models.py    |        901 |   896 |        0.6% |                                    53.3% |                    44.0% |                   21.8% |      22 |             15 |
| services.py  |       1099 |  1093 |        0.5% |                                    64.1% |                    56.3% |                   35.2% |      24 |             15 |
| test_auth.py |       1160 |  1151 |        0.8% |                                    73.4% |                    65.1% |                   30.6% |      22 |             17 |
| utils.py     |        637 |   631 |        0.9% |                                    61.1% |                    54.0% |                   33.8% |      19 |             10 |
| TOTAL        |       6568 |  6520 |        0.7% |                                    65.9% |                    58.1% |                   35.0% |     156 |             95 |

## What we do not know yet

- These numbers measure size only, and they use an approximate counter, so absolute values will change once a real tokenizer is integrated.
- The signatures numbers will change when the real renderer (S2-06) replaces this approximation. Re-run `npm run report:savings:write` then.
- Every `expand_symbol` call the agent makes adds tokens back, so the net saving per task is lower than the saving per file. That needs the evaluation.
- We have not yet measured how each level affects answer quality: whether an agent given light or signatures-only context answers questions about the code as accurately as with the raw source, and which kinds of questions break first when bodies are omitted.
