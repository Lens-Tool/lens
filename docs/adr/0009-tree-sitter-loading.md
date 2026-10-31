# ADR 0009: Tree-sitter loading strategy (WASM or native)

Status: Proposed (provisional, pending Windows and macOS results)
Owner: Aya Saad Rizk | Technical reviewer: Amr Mohamed Abdelrahman | Date: 2026-10-28

## Context

LENS parses Python, JavaScript and TypeScript to extract symbols for the compressor and the task layer. Spike S1-08 ran both loading approaches with the same symbol extractor: both parsed the test fixtures without syntax errors and produced identical symbols. The only results so far come from a Linux x64 sandbox, not from team machines. Details are in `docs/research/tree-sitter.md`.

## Options

1. **Native bindings.** `tree-sitter@0.21.1`, `tree-sitter-python@0.21.0`, `tree-sitter-javascript@0.21.4`, `tree-sitter-typescript@0.21.2`. Faster on the small fixtures. The packages ship prebuilt binaries only for Windows x64, Linux x64 and macOS (Intel and Apple Silicon); other platforms need a C++ compiler at install time. The latest versions of these packages do not install together (peer-dependency conflict), so versions must stay pinned.
2. **WASM.** `web-tree-sitter@0.22.6` with the grammar files from `tree-sitter-wasms@0.1.13`. Expected to install the same way on every OS because it needs no compiler (to be confirmed on Windows). Slower on the small fixtures; large-file speed is not measured yet.

## Decision

Use WASM as the default, behind a small shared `Parser` interface, with the versions above pinned together. The symbol extractor stays independent of how the parser is loaded, so native bindings can be added later as an optional optimization.

## Grammar files and packaging

Ship only the four grammar files we need, copied into `packages/compression/grammars/` (task S2-02):

- `tree-sitter-python.wasm`
- `tree-sitter-javascript.wasm`
- `tree-sitter-typescript.wasm`
- `tree-sitter-tsx.wasm`

Do not depend on the whole `tree-sitter-wasms` package at runtime: it is about 50 MB because it contains many languages. TSX was not covered by the spike and must be tested separately.

## Consequences and open questions

- `web-tree-sitter` and the grammar files must be upgraded and tested together: `web-tree-sitter@0.27.1` could not load the `tree-sitter-wasms@0.1.13` files.
- Windows and macOS results are recorded in the S1-08 report. Aya updates this ADR's status after them.
- Benchmark files of 1,000 lines or more before making any performance claim.
- Revisit this decision if Windows validation fails, WASM is too slow on large files, or native shows a clear advantage on all supported platforms.
- The native bindings expose the same node API as web-tree-sitter (spike S1-08, finding 5), so symbol extractors written against `SyntaxNode` work with either loader.
