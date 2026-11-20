# Test fixtures

Synthetic Python and TypeScript sample files used to test source code parsing, symbol extraction and compression.

All sample data is fictional. It contains no real project code, names, paths, credentials or personal information. Never copy code from a real project into this folder.

## Single-file fixtures

- `python/login.py`: sample authentication functions, token expiry and username formatting.
- `typescript/auth.ts`: a sample token interface and authentication functions.

## Python sample repository

Directory: `python-repo/`

Small modules that resemble a simple application, about 870 lines in total. The modules import each other, and `test_auth.py` runs with `python -m unittest discover -s fixtures/python-repo -p "test_*.py"`.

| File | Description |
|---|---|
| `auth.py` | Authentication service, sessions and login logic. Password handling is intentionally simplified (plain SHA-256): it is sample code, not a secure example. |
| `models.py` | User and profile data models. |
| `utils.py` | Text normalization, identifiers, checksums, pagination and data helpers. |
| `services.py` | User and notification services. |
| `database.py` | A simulated in-memory database. |
| `cli.py` | A command-line interface for the application. |
| `config.py` | Application configuration and validation. |
| `test_auth.py` | Unit tests for authentication and sessions. |

## Python edge cases

Directory: `python-edge/`

Special syntax and parsing situations. These files are parser test data and are not meant to be run.

| File | Description |
|---|---|
| `decorators.py` | Decorators that take arguments, and nested functions. |
| `async_code.py` | `async` and `await` functions. |
| `nested_classes.py` | Classes nested inside other classes, several levels deep. |
| `data_classes.py` | Dataclasses, including frozen ones and default factories. (Not called `dataclasses.py`, which would shadow the standard library module.) |
| `long_signatures.py` | Function signatures that span several lines, with type hints. |
| `comments_only.py` | Only comments, no executable code. |
| `empty_file.py` | A completely empty file (0 bytes). |
| `syntax_error.py` | Intentionally invalid Python (missing colons). |
| `crlf.py` | Windows (CRLF) line endings. |
| `tabs.py` | Indentation with tab characters. |
| `bom.py` | UTF-8 byte-order mark (U+FEFF) at the start of the file. |
| `non_ascii.py` | Non-ASCII identifiers and string content. |
| `long_line.py` | One source line well over 2k characters. |
| `no_final_newline.py` | The last line has no final newline. |

## Rules for these files

- Every file starts with code or a comment (never an empty first line) and ends with a final newline, except `empty_file.py` (empty) and `no_final_newline.py` (deliberately without one). Line numbers in golden test files depend on this.
- `syntax_error.py` must stay invalid; the tests expect the parser to flag it. Its name must contain `syntax_error`.
- `crlf.py` must keep CRLF line endings. `.gitattributes` marks it `-text` so Git does not convert it. After editing it, check that `git ls-files --eol fixtures/python-edge/crlf.py` still shows `i/crlf`.
- Do not rename or move a fixture without updating the golden files and this README.
- `fixtures` is listed in `.prettierignore`, so Prettier does not reformat these files.

## Regenerating Python golden files

Golden files in `packages/compression/src/python/golden/` are the saved, hand-reviewed expected output of the Python extractor for each fixture. If extractor behaviour changes, the golden tests show exactly what changed.

Regenerate `.symbols.json` golden files with:

```bash
npx tsx scripts/generate-python-golden.ts
```

Then run `git diff packages/compression/src/python/golden` and check every changed line against the fixture source.

### When regenerating is acceptable

- You intentionally changed extractor behaviour or the output schema, and you reviewed the diff against the fixture source.
- You added or modified a fixture. Review the new JSON by hand against the `.py` file before committing it.

### When regenerating is not acceptable

- A golden test fails and you don't understand why. Treat it as a regression and fix the extractor.
- You are regenerating only to make CI pass.
- The diff contains changes unrelated to your work.
- The fixture triggers a known extractor bug (for example `python-edge/syntax_error.py`). Don't create a golden for it. Add it to `EXCLUDED` in `golden.test.ts` instead.

Commit golden changes separately from code changes, and say in the commit message why the output changed.
