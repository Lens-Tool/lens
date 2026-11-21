# Python fixture token savings

Date: 2026-11-21
Token counter: js-tiktoken (cl100k_base)
Fixture: fixtures/python-repo (8 files)

Levels compared: raw (original source), light (`compressLight`: comments and blank lines removed), and signatures (`renderSignatures`: function and method bodies replaced by one marker line each; imports, variables, class and function headers, and docstrings kept). Percentages are tokens saved relative to raw. The signatures level is shown with both marker styles the renderer supports.

## Summary

| Level                                                                         | Tokens | Saved |
| ----------------------------------------------------------------------------- | -----: | ----: |
| Raw (original source)                                                         |   5469 |     - |
| Light (comments and blank lines removed)                                      |   5464 |  0.1% |
| Signatures, short marker `... # L8-11`                                        |   2833 | 48.2% |
| Signatures, long marker `... # lens: lines 8-11 omitted (expand_symbol name)` |   3697 | 32.4% |

## Findings

- The light level saves only 0.1%: comments and blank lines are a very small part of the tokens.
- Almost all the savings come from replacing function and method bodies, which is also the level that risks answer quality (not measured yet).
- The marker that replaces each body decides how much is saved: the signatures level saves 48.2% with the short marker and 32.4% with the long one. The long marker costs about 12.5 more tokens per replaced body, and it repeats the function name that is already on the line above it.
- 69 bodies were replaced out of 156 symbols (the rest are imports, variables, classes, and bodies too small to be worth replacing: the renderer keeps a body when its marker would not be shorter).
- The fixture is synthetic, so these percentages describe the fixture and not real projects. Real functions are usually longer, which would increase the savings, but that is not measured.

## Per file

Columns with "%" values show the tokens saved relative to raw.

| File         | Raw tokens | Light | Light saved | Signatures, short marker | Signatures, long marker | Symbols | Bodies omitted |
| ------------ | ---------: | ----: | ----------: | -----------------------: | ----------------------: | ------: | -------------: |
| auth.py      |        740 |   738 |        0.3% |                    59.1% |                   48.1% |      21 |              8 |
| cli.py       |        594 |   594 |        0.0% |                    58.9% |                   49.0% |      18 |              6 |
| config.py    |        351 |   351 |        0.0% |                    37.3% |                   25.6% |      12 |              4 |
| database.py  |        649 |   647 |        0.3% |                    44.4% |                   27.0% |      18 |              9 |
| models.py    |        786 |   786 |        0.0% |                    36.5% |                   24.3% |      22 |              9 |
| services.py  |        930 |   930 |        0.0% |                    46.5% |                   31.1% |      24 |             11 |
| test_auth.py |        783 |   783 |        0.0% |                    52.1% |                   19.9% |      22 |             15 |
| utils.py     |        636 |   635 |        0.2% |                    47.6% |                   35.2% |      19 |              7 |
| TOTAL        |       5469 |  5464 |        0.1% |                    48.2% |                   32.4% |     156 |             69 |

## What we do not know yet

- These numbers measure size with a real tokenizer (js-tiktoken), but they are not a model-specific usage measurement: other models tokenize differently.
- Every `expand_symbol` call the agent makes adds tokens back, so the net saving per task is lower than the saving per file. That needs the evaluation.
- We have not yet measured how each level affects answer quality: whether an agent given light or signatures-only context answers questions about the code as accurately as with the raw source, and which kinds of questions break first when bodies are omitted.
- The team has not yet chosen the final marker format. The renderer defaults to the long one; the short one saves more tokens but the agent must be told what it means.
