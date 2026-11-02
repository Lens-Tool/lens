# Python Fixtures

This directory contains synthetic Python and TypeScript sample files used for testing source code parsing and symbol extraction.

All sample data is fictional and does not contain real project code, credentials, or personal information.

## Existing Fixtures

### Python

- `python/login.py`: Contains sample authentication-related functions, token expiration logic, and username formatting.

### TypeScript

- `typescript/auth.ts`: Contains a sample token interface and authentication-related functions.

## Python Sample Repository

Directory: `python-repo/`

This directory contains small Python modules designed to resemble a simple application.

| File | Description |
|---|---|
| `auth.py` | Authentication service, sessions, and user login logic. |
| `models.py` | User and profile data models. |
| `utils.py` | Utility functions for text normalization, identifiers, checksums, and data handling. |
| `services.py` | User and notification services. |
| `database.py` | Simulated in-memory database operations. |
| `cli.py` | Command-line interface for application operations. |
| `config.py` | Application configuration and validation. |
| `test_auth.py` | Unit tests for authentication and session behavior. |

## Python Edge Cases

Directory: `python-edge/`

These files cover special Python syntax and parsing scenarios.

| File | Description |
|---|---|
| `decorators.py` | Decorators that accept arguments. |
| `async_code.py` | Asynchronous functions using `async` and `await`. |
| `nested_classes.py` | Nested classes inside other classes. |
| `dataclasses.py` | Dataclasses, including frozen dataclasses and default factories. |
| `long_signatures.py` | Multi-line function signatures and type hints. |
| `comments_only.py` | A file containing comments without executable code. |
| `empty_file.py` | An intentionally empty Python file. |
| `syntax_error.py` | Contains intentional syntax errors for parser error handling tests. |
| `crlf.py` | Uses Windows CRLF line endings. |

## Notes

- All fixtures are synthetic and created specifically for testing.
- `syntax_error.py` intentionally contains invalid Python syntax and should not be treated as a valid Python module.
- `empty_file.py` must remain completely empty.
- `crlf.py` must preserve Windows CRLF line endings.
- These fixtures are test data and are not intended for production use.