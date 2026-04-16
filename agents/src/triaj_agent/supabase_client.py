"""Supabase writes for the ingestion pipeline.

Writes to the real `cases` table when `SUPABASE_URL` + `SUPABASE_ANON_KEY`
(or `SUPABASE_SERVICE_ROLE_KEY`) are set; otherwise falls back to an
in-memory list so tests and `langgraph dev` runs without creds still work.

## Schema mapping

The current `cases` schema has: id, case_id, case_type, status, applicant_id,
assigned_to, case_notes, created_date, last_updated, created_at.

The agent produces a richer set of outputs (category, confidence, rationale,
anonymised_content, quarantine reason, document list). Until the schema adds
dedicated columns, those extras are serialised into `case_notes` as a JSON
blob. Swap to typed columns when the schema migration lands — only this file
needs to change.

## Policies

There is no `policies` table in the current schema — the frontend reads
policies from the `policy-documents` storage bucket. `update_policy()` keeps
writes in-memory so the categorize node can classify against recently-ingested
policies within the same process. When a real policies table exists, mirror
the `update_case` pattern here.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

log = logging.getLogger("triaj.supabase")

_CASE_WRITES: list[dict[str, Any]] = []
_POLICY_WRITES: list[dict[str, Any]] = []
_client = None
_client_checked = False


def _lazy_client():
    """Return the real Supabase client if env is set, else None."""

    global _client, _client_checked
    if _client_checked:
        return _client
    _client_checked = True

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if not url or not key:
        log.info("Supabase env vars unset — using in-memory mode")
        return None

    from supabase import create_client

    _client = create_client(url.rstrip("/"), key)
    return _client


_DIRECT_COLUMNS = {
    "status",
    "state",
    "ai_status",
    "assigned_to",
    "explanation",
    "rejection_reason",
    "score",
    "framework_version",
    "anonymised_at",
    "case_notes",
}


def _case_row(fields: dict[str, Any]) -> dict[str, Any]:
    """Map agent outputs onto the `cases` columns.

    Real columns (status, state, ai_status, explanation, rejection_reason,
    score, etc.) are passed through directly. Everything else (category,
    category_confidence, documents, ...) is JSON-packed into `case_notes`
    until dedicated columns exist.
    """

    now = datetime.now(timezone.utc).isoformat()
    row: dict[str, Any] = {"last_updated": now}

    for col in _DIRECT_COLUMNS - {"case_notes"}:
        if fields.get(col) is not None:
            row[col] = fields[col]

    extras = {
        k: v
        for k, v in fields.items()
        if k not in _DIRECT_COLUMNS and v is not None
    }
    notes_parts: list[str] = []
    if fields.get("case_notes"):
        notes_parts.append(str(fields["case_notes"]))
    if extras:
        notes_parts.append(json.dumps(extras, default=str, sort_keys=True))
    if notes_parts:
        row["case_notes"] = "\n\n".join(notes_parts)

    return row


def update_case(case_id: str, **fields: Any) -> dict[str, Any]:
    """Update a row in `cases` keyed by `case_id`.

    Assumes the row already exists (frontend's CreateCaseDialog creates it
    before triggering the agent). If the row is missing, Supabase returns 0
    affected rows — the caller should treat this as an error condition.
    """

    row = _case_row(fields)
    recorded = {"case_id": case_id, **row}
    _CASE_WRITES.append(recorded)
    log.info("supabase.cases update %s", recorded)

    client = _lazy_client()
    if client is not None:
        client.table("cases").update(row).eq("case_id", case_id).execute()
    return recorded


def update_policy(policy_id: str, **fields: Any) -> dict[str, Any]:
    """In-memory policy store.

    No `policies` table exists in the current schema — swap this to a real
    upsert when one does.
    """

    record = {"policy_id": policy_id, **fields}
    _POLICY_WRITES.append(record)
    log.info("supabase.policies upsert (in-memory) %s", record)
    return record


def get_writes() -> list[dict[str, Any]]:
    return list(_CASE_WRITES)


def get_policy_writes() -> list[dict[str, Any]]:
    return list(_POLICY_WRITES)


def list_policy_documents() -> list[dict[str, Any]]:
    """Return the full policy corpus for classification.

    Reads every file in the `policy-documents` Supabase storage bucket,
    extracts plain text via the shared LangChain loaders, and returns
    `[{policy_id, raw_content}, ...]`.

    Falls back to `_POLICY_WRITES` (the in-memory list populated by
    `update_policy` during a `kind="policy"` upload) when SUPABASE_URL /
    SUPABASE_ANON_KEY are unset — so tests and offline dev still work.
    Policies ingested via the graph in the current process are merged
    with the bucket contents, so newly-ingested policies are immediately
    visible to `categorize` without waiting for an upload to storage.
    """

    client = _lazy_client()
    if client is None:
        return get_policy_writes()

    from triaj_agent.loaders import load_bytes_as_text

    try:
        paths = _list_bucket_recursive(client, "policy-documents", "")
    except Exception as e:
        log.warning("failed to list policy-documents bucket: %s", e)
        return list(_POLICY_WRITES)

    storage = client.storage.from_("policy-documents")
    out: list[dict[str, Any]] = []
    for path in paths:
        try:
            data = storage.download(path)
        except Exception as e:
            log.warning("failed to download policy '%s': %s", path, e)
            continue
        try:
            text = load_bytes_as_text(path, data)
        except Exception as e:
            log.warning("failed to extract text from policy '%s': %s", path, e)
            continue
        if text.strip():
            out.append({"policy_id": path, "raw_content": text})

    # Include in-memory writes from the current process too — a policy uploaded
    # via the graph this run should be classifiable immediately, even if the
    # bucket doesn't reflect it yet.
    out.extend(get_policy_writes())
    return out


def _list_bucket_recursive(client, bucket: str, prefix: str) -> list[str]:
    """Recursively list every object path under `prefix` in `bucket`.

    supabase-py returns folder entries with `id is None`; file entries carry
    an id and metadata. Walk into folders, collect paths of files.
    """

    items = client.storage.from_(bucket).list(prefix) or []
    out: list[str] = []
    for item in items:
        name = item.get("name") or ""
        if not name:
            continue
        full = f"{prefix}/{name}" if prefix else name
        if item.get("id") is None:
            out.extend(_list_bucket_recursive(client, bucket, full))
        else:
            out.append(full)
    return out


def reset() -> None:
    """Clear in-memory state and force client re-init (used by tests)."""

    global _client, _client_checked
    _CASE_WRITES.clear()
    _POLICY_WRITES.clear()
    _client = None
    _client_checked = False
