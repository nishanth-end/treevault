"""Validation logic for TVF-1 binary tree archive format."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List

from .tree import LABEL_PATTERN, MAX_NODES


class ArchiveValidationError(ValueError):
    """Raised when a TVF-1 archive fails structural or syntactic validation."""


@dataclass(frozen=True)
class ParsedArchiveHeader:
    """Validated header and token list extracted from a TVF-1 archive."""

    declared_count: int
    tokens: List[str]


def validate_archive_text(archive_text: str) -> ParsedArchiveHeader:
    """Validate TVF-1 header, COUNT, DATA, and token/label syntax.

    Returns a ParsedArchiveHeader with the declared node count and raw tokens.
    Raises ArchiveValidationError with a clear message on any malformed input.
    """
    if not isinstance(archive_text, str) or not archive_text.strip():
        raise ArchiveValidationError("Archive text is empty.")

    # Normalize CRLF to LF and strip trailing blank lines only
    normalized = archive_text.replace("\r\n", "\n").replace("\r", "\n")
    lines = normalized.split("\n")
    while lines and lines[-1] == "":
        lines.pop()

    if len(lines) != 3:
        raise ArchiveValidationError(
            f"Invalid archive structure: expected exactly 3 lines (TVF-1, COUNT, DATA), got {len(lines)}."
        )

    header_line, count_line, data_line = lines

    if header_line != "TVF-1":
        raise ArchiveValidationError(
            f"Invalid header {header_line!r}: expected 'TVF-1'."
        )

    if not count_line.startswith("COUNT:"):
        raise ArchiveValidationError(
            f"Invalid COUNT field {count_line!r}: must start with 'COUNT:'."
        )
    count_str = count_line[len("COUNT:") :]
    if not count_str.isdigit():
        raise ArchiveValidationError(
            f"Invalid COUNT value {count_str!r}: must be a non-negative integer."
        )
    declared_count = int(count_str)
    if declared_count > MAX_NODES:
        raise ArchiveValidationError(
            f"Declared node count {declared_count} exceeds maximum of {MAX_NODES}."
        )

    if not data_line.startswith("DATA:"):
        raise ArchiveValidationError(
            f"Invalid DATA field {data_line!r}: must start with 'DATA:'."
        )
    data_payload = data_line[len("DATA:") :]
    if data_payload == "":
        raise ArchiveValidationError("DATA field cannot be empty.")

    tokens = data_payload.split(",")
    for idx, token in enumerate(tokens):
        if token == "X":
            continue
        if token.startswith("N:"):
            label = token[2:]
            if not LABEL_PATTERN.match(label):
                raise ArchiveValidationError(
                    f"Invalid label {label!r} at token index {idx}: "
                    "must be 1-16 chars of letters, digits, '_' or '-'."
                )
            continue
        raise ArchiveValidationError(
            f"Invalid token {token!r} at token index {idx}: expected 'X' or 'N:<label>'."
        )

    return ParsedArchiveHeader(declared_count=declared_count, tokens=tokens)
