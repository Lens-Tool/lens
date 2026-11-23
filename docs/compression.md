# Python Compression Pipeline

## 1. Overview

The compression pipeline reduces the token count of Python source files while preserving the structural information an agent needs to understand the codebase. It operates at three levels:

- **`raw`**: Returns the file unchanged (safe fallback).
- **`light`**: Removes blank lines and whole-line comments only.
- **`signatures`** (Python only): Keeps imports, module-level variables, class/function headers, and docstrings; replaces function and method bodies with a single marker line that references the original line range and the `expand_symbol` tool.

The `signatures` level is the primary token-saving mode. It is AST-based: the file is parsed with tree-sitter, symbols are extracted into a structured `SymbolNode[]`, and a renderer emits a signatures-only view that is still valid Python.

## 2. Pipeline

```
source (.py)
    │
    ▼
┌─────────────────────────────────────┐
│ Parse (web-tree-sitter WASM)        │
│ CodeParser.parse() → ParsedFile     │
│ ParsedFile = { language, root,      │
│                hasSyntaxError,      │
│                dispose() }          │
└─────────────────────────────────────┘
    │
    ├── hasSyntaxError ───► return raw + warning (see §4)
    │
    ▼
┌─────────────────────────────────────┐
│ Extract (extractPythonSymbols)      │
│ SyntaxNode → SymbolNode[]           │
│ SymbolNode = {                      │
│   id, name, qualifiedName, kind,    │
│   language, startLine, endLine,     │
│   signature, exported, docstring?,  │
│   body?: {startLine, endLine},      │
│   children?: SymbolNode[],          │
│   references?: SymbolReference[]    │
│ }                                   │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ Render (renderSignatures)           │
│ Options: { keepBodies?, marker? }   │
│ marker: 'long' | 'short' (default   │
│ 'long')                             │
└─────────────────────────────────────┘
    │
    ▼
CompressResult { content, language, level, warning? }
```

**Memory management**: `ParsedFile.dispose()` **must** be called after each file to free the WASM-backed parse tree (tree-sitter trees are not garbage-collected). The helper `withParsedFile(parser, source, language, fn)` parses, runs the synchronous callback `fn`, and guarantees `dispose()` in a `finally` block. Both `compressPython` and `extractPythonSymbolsFromSource` use it.

## 3. Levels

Defined as `CompressionLevel` in `@lens/shared/src/types.ts`:

| Level        | Description                                                                                                                                                                                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `raw`        | Safe fallback. Returns the original source unchanged. Used when the parser reports a syntax error, or when the caller explicitly requests it.                                                                                                                     |
| `light`      | Baseline (Sprint 1). Removes blank lines and whole-line comments via a line scanner. No AST involved. Default for `read_file_compressed`.                                                                                                                         |
| `signatures` | AST-based (Python only). Keeps imports, variables, decorators, class/function headers, docstrings, blank lines, and comments **outside** bodies. Replaces function/method bodies with a marker line (see §5). Never increases output size (tiny bodies are kept). |

## 4. Syntax-Error Fallback

**Rule (S2-07, from `docs/architecture.md`)**: If the parse tree has `hasSyntaxError === true`, the compressor returns the original source unchanged with `level: 'raw'` and a warning on `CompressResult`. It never extracts symbols or strips bodies from a broken tree — a parser problem is not a reason to omit source the agent might need.

```typescript
// From packages/compression/src/python/compress.ts
export const SYNTAX_ERROR_RAW_WARNING =
  'Syntax error detected; returning the file unchanged at level raw. ' +
  'Code is never omitted because of a parser problem.';
```

**Connector-level fallback**: If the `WasmParser` itself fails to initialise or load a grammar (e.g., missing WASM file), the `read_file_compressed` tool surfaces a `LensError` with code `INTERNAL` or `UNSUPPORTED_LANGUAGE`. The agent receives an error response rather than silent degradation.

## 5. Marker Format

The renderer replaces each droppable function/method body with exactly one line. Two styles exist (controlled by `RenderSignaturesOptions.marker`):

| Style            | Format                                                                  | Example                                                       |
| ---------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| `long` (default) | `... # lens: lines {from}-{to} omitted (expand_symbol {qualifiedName})` | `... # lens: lines 9-11 omitted (expand_symbol create_token)` |
| `short`          | `... # L{from}-{to}`                                                    | `... # L9-11`                                                 |

- Line numbers are **1-based, inclusive**, referring to the **original** file.
- The marker is indented to match the first line of the original body.
- A body is only replaced when the marker line is **shorter** than the original body text (so `def f(): return 1` stays intact).
- **The marker format is NOT final and may change** without notice. Agents should not parse markers; they should use `expand_symbol` to recover bodies.

## 6. Example: `login.py`

### Original (`fixtures/python/login.py`)

```python
# Authentication helpers for the sample project.
import time

TOKEN_TTL_SECONDS = 3600  # token expiry


def create_token(user_id: str) -> dict:
    """Create a session token that expires after TOKEN_TTL_SECONDS."""

    # Expiry is stored as an absolute timestamp.
    return {"user": user_id, "expires_at": time.time() + TOKEN_TTL_SECONDS}


def is_token_expired(token: dict) -> bool:
    return time.time() > token["expires_at"]


def format_username(name: str) -> str:
    # Unrelated helper: should be reducible to a signature later.
    return name.strip().lower()
```

### Compressed — `marker: 'long'` (default)

```python
# Authentication helpers for the sample project.
import time

TOKEN_TTL_SECONDS = 3600  # token expiry


def create_token(user_id: str) -> dict:
    """Create a session token that expires after TOKEN_TTL_SECONDS."""
... # lens: lines 9-11 omitted (expand_symbol create_token)


def is_token_expired(token: dict) -> bool:
    return time.time() > token["expires_at"]


def format_username(name: str) -> str:
    ... # lens: lines 19-20 omitted (expand_symbol format_username)
```

### Compressed — `marker: 'short'`

```python
# Authentication helpers for the sample project.
import time

TOKEN_TTL_SECONDS = 3600  # token expiry


def create_token(user_id: str) -> dict:
    """Create a session token that expires after TOKEN_TTL_SECONDS."""
... # L9-11


def is_token_expired(token: dict) -> bool:
    ... # L15-15


def format_username(name: str) -> str:
    ... # L19-20
```

### Token counts (using the project's token counter)

| Version      | Tokens | Counter                           |
| ------------ | ------ | --------------------------------- |
| Original     | 137    | `TiktokenCounter` (`cl100k_base`) |
| Long marker  | 115    | `TiktokenCounter` (`cl100k_base`) |
| Short marker | 93     | `TiktokenCounter` (`cl100k_base`) |

**Counter details**: The project uses `TiktokenCounter` (in `packages/compression/src/tokens.ts`) backed by `js-tiktoken@1.0.21` with the `cl100k_base` encoding (OpenAI's tokenizer for GPT-4 / GPT-3.5-turbo). Counts are **exact for normal text** but **extrapolated (approximate) for runs of >128 identical character-class characters** (letters, whitespace, or symbols). A fallback `ApproxTokenCounter` (~4 chars/token) is used if the library fails to load. Per ADR 0010: _"Counts are close estimates for non-OpenAI models (Claude, etc. tokenize differently); not billing-accurate for other models."_

**Important**: Answer quality has **NOT been measured**. Fewer tokens does not imply the agent answers equally well. See `docs/research/python-savings.md` for aggregate savings numbers and caveats.

## 7. Mermaid Diagram

```mermaid
flowchart TD
    A[Source .py] --> B{CodeParser.parse}
    B --> C[ParsedFile]
    C --> D{hasSyntaxError?}
    D -- Yes --> E[Return raw + warning]
    D -- No --> F[extractPythonSymbols]
    F --> G[SymbolNode[]]
    G --> H[renderSignatures]
    H --> I{marker style}
    I -- long --> J[Long marker output]
    I -- short --> K[Short marker output]
    J --> L[CompressResult{level: signatures}]
    K --> L
    L --> M[ParsedFile.dispose]
    E --> M
    M --> N[Done]
```

## 8. Known Limits

| Limit                     | Status                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Language support**      | Python only. JavaScript, TypeScript, and TSX are planned (grammars bundled per ADR 0009).                                                                                                                                                                                                                                                                                                 |
| **Body recovery**         | `expand_symbol` is **fully implemented** (`packages/connector/src/expandSymbol.ts`). It accepts a symbol name or qualified name, parses the file, finds matching symbols, and returns their full source content with token accounting. Agents recover bodies by calling `expand_symbol`.                                                                                                  |
| **Extractor gaps**        | Known and documented in `extract.ts`: nested functions/lambdas not extracted; defs inside `if`/`try`/`with` blocks skipped; multi-part docstrings (`"a" "b"`) not recognised; comments between header and first statement counted as body; `__all__` not read for export control; same-name siblings (getter/setter, `@overload`) all returned with unique `id` but same `qualifiedName`. |
| **Secrets redaction**     | **Not implemented**. Secrets (API keys, passwords, tokens) in a file pass through unchanged. A `TODO(redaction)` exists in `expandSymbol.ts:179`; no redaction code exists in the compressor.                                                                                                                                                                                             |
| **Token counting**        | Uses `cl100k_base` (OpenAI). Exact for normal text; extrapolated for long runs. Not billing-accurate for Claude or other models. See ADR 0010.                                                                                                                                                                                                                                            |
| **Marker format**         | **Not final**. May change without notice. Agents must use `expand_symbol`, not parse markers.                                                                                                                                                                                                                                                                                             |
| **Syntax errors**         | On `hasSyntaxError`, file returns `raw` unchanged. Broken definitions inside an otherwise valid file are skipped during extraction (rest still extracted).                                                                                                                                                                                                                                |
| **Output size guarantee** | Renderer never increases output size (marker must be shorter than body).                                                                                                                                                                                                                                                                                                                  |
| **EOL/BOM preservation**  | Renderer preserves original line endings (`\n` or `\r\n`).                                                                                                                                                                                                                                                                                                                                |

---

_Generated from code as of `develop` branch. All names, levels, markers, and statuses reflect the actual implementation._
