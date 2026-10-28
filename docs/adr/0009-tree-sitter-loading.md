# ADR 0009: Tree-sitter loading strategy (WASM vs native)

**Status:** Proposed — pending Windows and macOS validation  
**Owner:** Aya Saad Rizk  
**Technical reviewers:** Amr Mohamed Abdelrahman, team review  
**Date:** 2026-10-28

## Context

LENS needs to parse Python, JavaScript, and TypeScript source files to extract symbols for the compressor and task layer.

The S1-08 spike tested native Tree-sitter bindings and the WASM build using the same symbol extractor. Both approaches parsed the tested fixtures without syntax errors and produced identical extracted symbols.

The current Linux x64 results are from a sandbox, not a team machine. Windows and macOS validation is still pending.

## Options

1. **Native bindings:** Use `tree-sitter` and the corresponding language grammar packages. This approach was faster on the small test fixtures but depends on compatible native binaries or a working build toolchain on supported platforms.
2. **WASM:** Use `web-tree-sitter` with compatible compiled grammar files. This approach avoids requiring a platform-specific native build toolchain and is suitable for evaluating cross-platform installation.

## Decision

Provisionally choose WASM as the default Tree-sitter loading approach, behind a small shared `Parser` interface.

Use the following pinned package versions from spike S1-08:

- `web-tree-sitter@0.22.6`
- `tree-sitter-wasms@0.1.13`

Keep the shared symbol extractor independent of the loading implementation. Native bindings may be reconsidered as an optional optimization after cross-platform validation and performance benchmarking.

The recommendation is conditional on successful Windows validation and acceptable performance on representative large files.

## Grammar files and packaging

The published package should include only the grammar files required for the supported languages:

- Python
- JavaScript
- TypeScript
- TSX

Do not ship the entire `tree-sitter-wasms` package if it includes unnecessary grammars.

Before finalizing the package configuration, verify the actual grammar filenames, their locations, and the loading paths used by the project. TSX support must be tested separately because it was not covered by the original spike.

## Validation

Before treating this decision as final:

- Repeat the native and WASM installation and parsing tests on a real Windows machine.
- Record the operating system, architecture, Node.js version, installation result, parsing result, and installation time.
- Obtain a macOS result or document the status of the second-platform validation.
- Verify that both approaches produce equivalent symbols for the existing Python, JavaScript, and TypeScript fixtures.
- Benchmark representative files of 1,000 or more lines before making performance claims.
- Confirm that the pinned WASM runtime loads the selected grammar files successfully.

The original spike found that `web-tree-sitter@0.27.1` could not load the grammar files from `tree-sitter-wasms@0.1.13`. These versions must not be mixed without revalidating compatibility.

## Consequences and open questions

- WASM is expected to simplify cross-platform installation by avoiding platform-specific native binaries and compiler requirements.
- Native bindings were faster on the small fixtures, but larger-file performance has not yet been established.
- The WASM runtime and grammar versions must remain compatible and should be upgraded and tested together.
- The package must include the correct grammar files and preserve their expected runtime paths.
- The shared `Parser` interface should isolate the rest of LENS from implementation-specific loading details.
- The decision should be revisited if Windows validation fails, WASM performance is unacceptable, or native bindings demonstrate a meaningful advantage across supported platforms.

## References

- `docs/research/tree-sitter.md`
- Spike S1-08: tree-sitter in Node (native vs WASM) and SymbolNode design
