# Python fixture token savings

Date: 2026-11-05
Token counter: approx-chars-div-4 (rough estimate, about 4 characters per token; not a real tokenizer)
Fixture: fixtures/python-repo (8 files)

Levels compared: raw (original source), light (compressLight: comments and blank lines removed), signatures (function and method bodies removed using the extracted symbol ranges; imports, variables, class and function headers kept). Percentages are tokens saved relative to raw.

| File         |  Raw | Light | Light saved | Signatures | Signatures saved | Symbols | Bodies omitted |
| ------------ | ---: | ----: | ----------: | ---------: | ---------------: | ------: | -------------: |
| auth.py      |  915 |   908 |        0.8% |        255 |            72.1% |      21 |             10 |
| cli.py       |  729 |   724 |        0.7% |        190 |            73.9% |      18 |              9 |
| config.py    |  401 |   396 |        1.2% |        155 |            61.3% |      12 |              7 |
| database.py  |  726 |   721 |        0.7% |        266 |            63.4% |      18 |             12 |
| models.py    |  901 |   896 |        0.6% |        421 |            53.3% |      22 |             15 |
| services.py  | 1099 |  1093 |        0.5% |        395 |            64.1% |      24 |             15 |
| test_auth.py | 1160 |  1151 |        0.8% |        308 |            73.4% |      22 |             17 |
| utils.py     |  637 |   631 |        0.9% |        248 |            61.1% |      19 |             10 |
| TOTAL        | 6568 |  6520 |        0.7% |       2238 |            65.9% |     156 |             95 |

## What we do not know yet

These numbers measure size only, and they use an approximate counter, so absolute values will change once a real tokenizer is integrated. We have not yet measured how each level affects answer quality: whether an agent given light or signatures-only context answers questions about the code as accurately as with the raw source, and which kinds of questions break first when bodies are omitted.
