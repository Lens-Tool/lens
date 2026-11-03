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
| `no_final_newline.py` | The last line has no final newline. |

## Rules for these files

- Every file starts with code or a comment (never an empty first line) and ends with a final newline, except `empty_file.py` (empty) and `no_final_newline.py` (deliberately without one). Line numbers in golden test files depend on this.
- `syntax_error.py` must stay invalid; the tests expect the parser to flag it. Its name must contain `syntax_error`.
- `crlf.py` must keep CRLF line endings. `.gitattributes` marks it `-text` so Git does not convert it. After editing it, check that `git ls-files --eol fixtures/python-edge/crlf.py` still shows `i/crlf`.
- Do not rename or move a fixture without updating the golden files and this README.
- `fixtures` is listed in `.prettierignore`, so Prettier does not reformat these files.
