# This file contains comments only.
# It is intentionally created as a parser edge case.
#
# The parser should handle:
# - Multiple consecutive comments.
# - Empty comment lines.
# - Comments with special characters: @ # $ % & *
# - Comments containing Python-like syntax.
#
# def fake_function(value: int) -> str:
#     return str(value)
#
# class FakeClass:
#     pass
#
# End of comments-only fixture.