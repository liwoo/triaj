"""In-memory Supabase write stub.

Replace with the real `supabase-py` client (or a direct Postgres connection
against the `cases` table) once the backend is stood up. The rest of the
graph calls only `update_case()`, so the swap is one file.
"""

from __future__ import annotations

import logging
from typing import Any

log = logging.getLogger("triaj.supabase")

_CASE_WRITES: list[dict[str, Any]] = []
_POLICY_WRITES: list[dict[str, Any]] = []


def update_case(case_id: str, **fields: Any) -> dict[str, Any]:
    """Upsert a row into the stubbed `cases` table and return it."""

    record = {"case_id": case_id, **fields}
    _CASE_WRITES.append(record)
    log.info("supabase.cases upsert %s", record)
    return record


def update_policy(policy_id: str, **fields: Any) -> dict[str, Any]:
    """Upsert a row into the stubbed `policies` table and return it."""

    record = {"policy_id": policy_id, **fields}
    _POLICY_WRITES.append(record)
    log.info("supabase.policies upsert %s", record)
    return record


def get_writes() -> list[dict[str, Any]]:
    return list(_CASE_WRITES)


def get_policy_writes() -> list[dict[str, Any]]:
    return list(_POLICY_WRITES)


def reset() -> None:
    _CASE_WRITES.clear()
    _POLICY_WRITES.clear()
