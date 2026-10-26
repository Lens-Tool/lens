# Spike S1-08: tree-sitter in Node (native vs WASM) and SymbolNode design

Owner: Aya Saad Rizk | Reviewers: Amr Mohamed Abdelrahman, Lama Hany Shaker (SymbolNode) | Status: DRAFT, needs Windows and macOS results

## 1. Question

Can we run tree-sitter with the Python, JavaScript and TypeScript grammars from Node.js on every OS our team and users have, and should we use the native bindings or the WASM build (`web-tree-sitter`)?

## 2. What was tested

Spike code: branch `spike/S1-08-tree-sitter`, folder `spikes/tree-sitter` (not merged into `develop`). One shared extractor (`symbols.mjs`) runs unchanged on both approaches; only the loading code differs.

| Approach | Packages (exact versions)                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------------------------- |
| Native   | `tree-sitter@0.21.1`, `tree-sitter-python@0.21.0`, `tree-sitter-javascript@0.21.4`, `tree-sitter-typescript@0.21.2` |
| WASM     | `web-tree-sitter@0.22.6`, `tree-sitter-wasms@0.1.13`                                                                |

Inputs: `fixtures/python/login.py`, `fixtures/typescript/auth.ts`, `spikes/tree-sitter/sample.js`.

## 3. Results

Both approaches parsed all three files with no syntax errors and produced identical symbols (functions, classes, methods, imports, variables, line ranges, signatures, Python docstrings).

### Results per operating system

Fill one row per machine. Linux x64 was run by Claude in a sandbox as a first pass; the team must repeat it on real machines.

| OS / arch / Node             | Tester                  | Native install         | Native works | WASM install | WASM works | Install time       | Notes                                                       |
| ---------------------------- | ----------------------- | ---------------------- | ------------ | ------------ | ---------- | ------------------ | ----------------------------------------------------------- |
| Linux x64, Node 22.22        | (sandbox, not the team) | OK, no compiler needed | yes          | OK           | yes        | about 2 s (cached) | Parse of the tiny fixtures: native 0.2-1.6 ms, WASM 4-10 ms |
| Windows ... , Node ...       | Aya                     |                        |              |              |            |                    |                                                             |
| macOS or second OS, Node ... | (teammate)              |                        |              |              |            |                    |                                                             |

## 4. Findings and pitfalls

1. **Versions must be pinned together.** Installing the latest `tree-sitter` with the latest grammars fails with an npm peer-dependency conflict (`tree-sitter-typescript` expects `tree-sitter@^0.21`). We pin the 0.21 line for native.
2. **WASM runtime and grammar files must match.** `web-tree-sitter@0.27.1` could not load the `tree-sitter-wasms@0.1.13` grammar files (it failed while reading the module metadata). `web-tree-sitter@0.22.6` works. Upgrade both together and re-run the spike each time.
3. **Native prebuilt binaries cover only some platforms.** All four native packages ship prebuilt binaries for darwin-arm64, darwin-x64, linux-x64 and win32-x64. Other platforms (for example Windows or Linux on ARM) would need a C++ compiler and node-gyp at install time. This must be confirmed on a real Windows machine.
4. **`tree-sitter-wasms` is large (about 50 MB, all languages).** For a published npm package we should ship only the grammar files we need (Python, JavaScript, TypeScript, TSX), not the whole package.
5. **API differs between the two builds at load time only.** Node objects (`type`, `namedChildren`, `childForFieldName`, positions) behave the same, so the compressor can hide the loader behind one interface.
6. **Comments are separate nodes.** A comment between a Python `:` and the first body line is not part of the signature; take the signature from the parameters/return type, not from "text up to the body". JSDoc comments are siblings of the function node, not children, so JS/TS docstrings need a "previous comment" lookup.
7. **Parsing is fast either way** on small files; WASM was slower in this small test. Measure on 1,000+ line files before treating speed as a decision factor.

## 5. Recommendation (provisional)

Use **WASM (`web-tree-sitter`) as the default**, behind a small `Parser` interface, and keep native as an optional later optimization.

Reasons: it installs the same way on every OS with no compiler and no platform-specific binaries, which matters for a tool published on npm and installed by one command on unknown machines; the extractor already works unchanged on both; speed is not a bottleneck at this file size.

Change the recommendation to native if the Windows or macOS tests show that WASM fails or is too slow on large files, or if native proves to install cleanly on all team machines and speed matters in the benchmark.

## 6. Install instructions (for the report)

```bash
cd spikes/tree-sitter
npm install
npm run native   # native bindings
npm run wasm     # WASM build
```

## 7. SymbolNode (draft for review by Lama)

Aligns with `SymbolRef` in `packages/shared/src/tools.ts`: a `SymbolNode` is a `SymbolRef` plus the extra detail the compressor and the task layer need. `SymbolKind` in `tools.ts` needs `'interface'` and `'type'` added (TypeScript fixtures contain both).

```ts
export type SymbolKind =
  'function' | 'method' | 'class' | 'interface' | 'type' | 'variable' | 'import';

export interface SymbolReference {
  /** Name being referenced, e.g. "TOKEN_TTL_SECONDS". */
  name: string;
  /** 1-based line of the reference. */
  line: number;
  kind: 'call' | 'read' | 'import' | 'type';
}

export interface SymbolNode {
  /** Unique inside one file: qualified name plus kind, e.g. "Cache.get:method". Local only. */
  id: string;
  name: string;
  /** "Cache.get" for methods, otherwise equal to name. */
  qualifiedName: string;
  kind: SymbolKind;
  language: 'python' | 'javascript' | 'typescript';
  /** 1-based, inclusive. Whole symbol including its body. */
  startLine: number;
  endLine: number;
  /** Header only, no body: "def create_token(user_id: str) -> dict". */
  signature: string;
  /** Python docstring or preceding JSDoc comment, if any. */
  docstring?: string;
  exported: boolean;
  /** Lines that can be dropped when only the signature is kept. */
  body?: { startLine: number; endLine: number };
  /** Methods of a class. */
  children?: SymbolNode[];
  /** Filled by a later step (scoring / task layer), not by the parser. */
  references?: SymbolReference[];
}
```

Questions for the review:

1. Should `references` live on `SymbolNode`, or in a separate map built by the task layer (Lama)?
2. Do we need byte offsets for diffs and caching (Amr)?
3. Is a flat list plus `children` enough, or do we want a full tree?

## 8. Known limits of this spike

- It lists definitions only. References (calls, reads) are not extracted yet; that needs tree-sitter queries or a second walk.
- Only top-level declarations and class methods are covered. Nested functions, decorators with arguments and Python `async def` are not tested.
- Python class/superclass signatures and TSX files were not tested.
- Linux results come from a sandbox; Windows and macOS results are still empty.
