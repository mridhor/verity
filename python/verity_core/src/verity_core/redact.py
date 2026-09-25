"""PII redaction for application logs (NFR-SEC-05, rule 9).

Logs must never carry document text, prompts or decision-model state; this filter is a
last line of defence for identifiers that slip into messages anyway.
"""

from __future__ import annotations

import logging
import re

_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\b\d{16}\b"), "[NIK]"),  # NIK / KK number
    (re.compile(r"\b\d{2}\.\d{3}\.\d{3}\.\d-\d{3}\.\d{3}\b"), "[NPWP]"),  # NPWP 15-digit format
    (re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b"), "[EMAIL]"),
    (re.compile(r"\beyJ[\w-]+\.[\w-]+\.[\w-]+\b"), "[JWT]"),
    (re.compile(r"(?:\+62|\b0)8\d{8,11}\b"), "[TELP]"),
]


def redact(text: str) -> str:
    for pattern, replacement in _PATTERNS:
        text = pattern.sub(replacement, text)
    return text


class RedactingFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = redact(record.getMessage())
        record.args = None
        return True
