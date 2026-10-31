# Bundled grammars

Only the grammar files LENS loads live here (ADR 0009). The list is `GRAMMAR_FILES` in
`src/parser/grammars.ts`, and a test fails if this folder and that list disagree.

| File                      | Source                                                    | SHA-256                                                            |
| ------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------ |
| `tree-sitter-python.wasm` | `tree-sitter-wasms@0.1.13`, `out/tree-sitter-python.wasm` | `9056d0fb0c337810d019fae350e8167786119da98f0f282aceae7ab89ee8253b` |

They must match `web-tree-sitter@0.22.6` (pinned). Upgrade both together.
`tree-sitter-wasms` (about 50 MB) is never a dependency: to add a language, download the package
once (`npm pack tree-sitter-wasms@0.1.13`), copy the single file, and list it in `GRAMMAR_FILES`.

## Verify a bundled file

A binary cannot be read in a code review, so check its hash against the original package:

```powershell
npm pack tree-sitter-wasms@0.1.13
tar -xzf tree-sitter-wasms-0.1.13.tgz
Get-FileHash .\package\out\tree-sitter-python.wasm -Algorithm SHA256
Get-FileHash .\packages\compression\grammars\tree-sitter-python.wasm -Algorithm SHA256
```

On Linux or macOS use `sha256sum file` (or `shasum -a 256 file`) instead of `Get-FileHash`.

Both hashes must equal the value in the table. The same value is in `GRAMMAR_SHA256`
(`src/parser/grammars.ts`) and a test fails if the bundled file differs. Update the table, that
constant and the test data together when you add or replace a grammar.
