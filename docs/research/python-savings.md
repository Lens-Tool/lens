# Python fixture token savings

Date: 2026-11-15
Token counter: approx-chars-div-4 (rough estimate, about 4 characters per token; not a real tokenizer)
Fixture: fixtures/python-repo (8 files)

Levels compared: raw (original source), light (`compressLight`: comments and blank lines removed), and signatures (`renderSignatures`: function and method bodies replaced by one marker line each; imports, variables, class and function headers, and docstrings kept). Percentages are tokens saved relative to raw. The signatures level is shown with both marker styles the renderer supports.

## Summary

| Level                                                                         | Tokens | Saved |
| ----------------------------------------------------------------------------- | -----: | ----: |
| Raw (original source)                                                         |   6568 |     - |
| Light (comments and blank lines removed)                                      |   6520 |  0.7% |
| Signatures, short marker `... # L8-11`                                        |   2771 | 57.8% |
| Signatures, long marker `... # lens: lines 8-11 omitted (expand_symbol name)` |   4119 | 37.3% |

## Findings

- The light level saves only 0.7%: comments and blank lines are a very small part of the tokens.
- Almost all the savings come from replacing function and method bodies, which is also the level that risks answer quality (not measured yet).
- The marker that replaces each body decides how much is saved: the signatures level saves 57.8% with the short marker and 37.3% with the long one. The long marker costs about 19.5 more tokens per replaced body, and it repeats the function name that is already on the line above it.
- 69 bodies were replaced out of 156 symbols (the rest are imports, variables, classes, and bodies too small to be worth replacing: the renderer keeps a body when its marker would not be shorter).
- The fixture is synthetic, so these percentages describe the fixture and not real projects. Real functions are usually longer, which would increase the savings, but that is not measured.

## Per file

Columns with "%" values show the tokens saved relative to raw.

| File         | Raw tokens | Light | Light saved | Signatures, short marker | Signatures, long marker | Symbols | Bodies omitted |
| ------------ | ---------: | ----: | ----------: | -----------------------: | ----------------------: | ------: | -------------: |
| auth.py      |        915 |   908 |        0.8% |                    65.8% |                   50.4% |      21 |              8 |
| cli.py       |        729 |   724 |        0.7% |                    67.2% |                   53.2% |      18 |              6 |
| config.py    |        401 |   396 |        1.2% |                    51.6% |                   33.7% |      12 |              4 |
| database.py  |        726 |   721 |        0.7% |                    54.0% |                   31.1% |      18 |              9 |
| models.py    |        901 |   896 |        0.6% |                    43.7% |                   27.2% |      22 |              9 |
| services.py  |       1099 |  1093 |        0.5% |                    56.2% |                   36.4% |      24 |             11 |
| test_auth.py |       1160 |  1151 |        0.8% |                    64.9% |                   32.1% |      22 |             15 |
| utils.py     |        637 |   631 |        0.9% |                    53.5% |                   34.9% |      19 |              7 |
| TOTAL        |       6568 |  6520 |        0.7% |                    57.8% |                   37.3% |     156 |             69 |

## What we do not know yet

- These numbers measure size only, and they use an approximate counter, so absolute values will change once the real tokenizer (S2-10) is integrated. Re-run `npm run report:savings:write` then.
- Every `expand_symbol` call the agent makes adds tokens back, so the net saving per task is lower than the saving per file. That needs the evaluation.
- We have not yet measured how each level affects answer quality: whether an agent given light or signatures-only context answers questions about the code as accurately as with the raw source, and which kinds of questions break first when bodies are omitted.
- The team has not yet chosen the final marker format. The renderer defaults to the long one; the short one saves more tokens but the agent must be told what it means.
