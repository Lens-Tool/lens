# Bundled grammars

Only the grammar files LENS loads live here (ADR 0009). The list is `GRAMMAR_FILES` in
`src/parser/grammars.ts`, and a test fails if this folder and that list disagree.

| File                      | Source                                                    |
| ------------------------- | --------------------------------------------------------- |
| `tree-sitter-python.wasm` | `tree-sitter-wasms@0.1.13`, `out/tree-sitter-python.wasm` |

They must match `web-tree-sitter@0.22.6` (pinned). Upgrade both together.
`tree-sitter-wasms` (about 50 MB) is never a dependency: to add a language, download the package
once (`npm pack tree-sitter-wasms@0.1.13`), copy the single file, and list it in `GRAMMAR_FILES`.
