# ADR 0010: Token counter choice (js-tiktoken)

Status: Proposed
Owner: Amr Mohamed Abdelrahman | Technical reviewer: TBD | Date: 2026-11-22

## Context

LENS needs a real token counter to replace the placeholder `ApproxTokenCounter` (≈4 chars/token). The counter is used in:

- `readFileCompressed` and `expandSymbol` (connector package) — reports `tokensBefore`/`tokensAfter` in usage events
- `scripts/report-savings.ts` — generates `docs/research/python-savings.md`

The counter must be synchronous, never throw, and have a graceful fallback if the library fails to load.

## Options

1. **`js-tiktoken` (pure JS, 1.0.21)** — Lite entry `js-tiktoken/lite` + `js-tiktoken/ranks/cl100k_base`. No native code, no WASM, no cleanup needed. Load time ~290 ms. Per-file count ~1–5 ms for typical code. Both libraries are quadratic on long boundary-less runs; the WASM package is much faster (measured 5,000 'x': WASM ~25 ms vs js-tiktoken ~4.3 s).

2. **`tiktoken` (WASM, 1.0.22)** — Official OpenAI package with Rust/WASM backend. Load time ~130 ms. Per-file count similar. Requires explicit `.free()` to release WASM memory.

## Decision

Use **`js-tiktoken@1.0.21`** (exact version, no `^`) via the lite entry point, added to `packages/compression` only (not `packages/shared`).

Encoding: **`cl100k_base`** — stable, widely used OpenAI encoding for GPT-4/3.5-turbo. Counts are close estimates for non-OpenAI models (Claude, etc. tokenize differently); not billing-accurate for other models.

Special tokens: Always call `encode(text, [], [])` so special tokens like `<|endoftext|>`, `<|fim_prefix|>`, etc. are counted as plain text (default call throws). The `count()` method must never throw for any string.

## Implementation

- `packages/compression/src/tokens.ts`: `TiktokenCounter` implements `TokenCounter`; `getDefaultTokenCounter()` is a lazy process-wide singleton.
  - First call: constructs encoder, runs smoke test `encode('hello world', [], [])`.
  - On success: caches and returns `TiktokenCounter` (`name = 'tiktoken-cl100k_base'`).
  - On ANY failure: logs ONE fixed `[lens] tiktoken unavailable, using approximate token counter` to stderr, caches and returns `ApproxTokenCounter` (`name = 'approx-chars-div-4'`).
  - Subsequent calls: return cached instance (never switches mid-process).
  - Test-only helpers: `resetTokenCounterForTest()`, `setTokenCounterLoaderForTest()` for fallback testing.

- Connector functions (`readFileCompressed`, `expandSymbol`): use `deps.counter ?? getDefaultTokenCounter()` (keep DI for tests).

- Savings report (`scripts/report-savings.ts`): uses `getDefaultTokenCounter()`, prints `Counter: ${counter.name}`.

## Consequences

- No native dependencies, no compiler toolchain needed on any platform.
- No `dispose()`/`free()` needed — matches existing `TokenCounter` interface (sync, stateless).
- Fallback is silent to the caller (only one `[lens]` line on stderr, no paths/input text).
- `scripts/report-savings.ts` output regenerated with real counts (see `docs/research/python-savings.md`).

## Known limitations

- **Quadratic complexity on long boundary-less runs**: Pure-JS BPE is quadratic on long runs of a single character class without boundaries.
  Measured unguarded 5,000 chars:
  - `'x'` repeated: ~4.3 s
  - `' '` repeated: ~4.4 s
  - `'='` repeated: ~4.5 s
  - `'ab'` repeated: ~6 s
  - Alphabet repeated: ~12.8 s
  - Random lowercase letters: ~11 s
  - CJK without punctuation: ~37 s
    Normal code and minified JS are fast: 100k chars of minified JS ~23 ms.

- **Extrapolated estimates for long runs**: Counts for same-class runs over 128 chars are extrapolated from a 128-char sample; everything else is counted exactly.
  For highly periodic letter runs the estimate can be far off:
  - Measured +62.7% on alphabet repeated to 5,018 chars (314 vs 193 tokens)
  - Random letters: +2.2%
  - CJK without punctuation: -0.6%
  - `'x'`, `' '`, `'='`, `'-'`, `'ab'` repeated: 0%
    Digits break the character classes, so the guard does not engage on base64/URL-safe text. Unguarded 100k-char base64 took ~0.7 s (varied) and ~2.5 s (URL-safe). Mixed-class boundary-less text is not covered by the guard. The guard removes the measured freezes for same-class runs only (1M chars now < 20 ms guarded vs ~11 s unguarded for those cases).

- **WASM trade-offs**: The WASM `tiktoken` package is much faster on pathological cases but was rejected due to:
  - Requires explicit `.free()` to release WASM memory (adds cleanup burden, leak risk)
  - Increases install size

- **js-tiktoken vs WASM difference**: js-tiktoken and WASM `tiktoken` differed by 1 token on `python-edge/bom.py` (31 vs 30).

- **One-time load cost**: The first `getDefaultTokenCounter()` call pays a one-time ~360 ms lazy initialization (singleton).

- **Model accuracy**: `cl100k_base` is an OpenAI encoding. Counts for Claude, Gemini, etc. are close estimates, not exact.

- **No special token awareness**: All text counted as plain text. For code this is the desired behavior.

- **Other pathological patterns may exist**: The current guard covers runs of letters, whitespace, and symbols. Other patterns (e.g., very long base64 with mixed classes) may still exhibit slowdowns; they can be addressed if encountered.

## Guard

The guard splits text at runs of ≥129 identical character-class characters (`\p{L}`, `\s`, or `[^\s\p{L}\p{N}]`). Non-run segments are counted exactly with `encode(text, [], [])`. Each run is sampled at 128 chars, its tokens measured, then extrapolated: `ceil(sampleTokens * runLength / 128)`. T = 128 is the largest tested threshold (64, 96, 128, 160, 192) where the worst measured case ('x') costs under about 5 ms per sample. Gaps between runs are still encoded in one call each, so boundary-less text made of mixed classes is not bounded by this guard.
