from __future__ import annotations

from operator import add
from typing import Annotated, Literal, TypedDict

from pydantic import BaseModel, Field


class ParsedDocument(BaseModel):
    """A single file parsed from the case folder by a LangChain loader."""

    source: str = Field(description="Original file path or object key inside the bucket.")
    content: str = Field(description="Extracted plain text.")
    metadata: dict = Field(default_factory=dict)


class TraceEvent(TypedDict, total=False):
    node: str
    status: Literal["ok", "skipped", "quarantined", "error"]
    message: str


Kind = Literal["case", "policy"]


class CaseState(TypedDict, total=False):
    """State threaded through the ingestion graph.

    Invoked with `case_id`, `kind` ("case" or "policy"), and *either*:
    - `bucket` + `folder` → pull from Supabase Storage (uses SUPABASE_URL /
      SUPABASE_ANON_KEY from env), or
    - `local_path` → read from the local filesystem (dev/test escape hatch).

    Flow:
    - kind="case"   → extract → validate → (quarantine | pii_filter → categorize → persist)
    - kind="policy" → extract → persist

    Quarantine and persist both write to Supabase (cases table for case kind,
    policies table for policy kind).
    """

    # ---- input ----
    case_id: str
    kind: Kind
    bucket: str        # Supabase Storage bucket name (e.g. "uploads-quarantine")
    folder: str        # prefix inside the bucket
    local_path: str    # alternative: a local filesystem path

    # ---- extract ----
    documents: list[ParsedDocument]
    raw_content: str

    # ---- validate ----
    is_processable: bool
    quarantine_reason: str | None

    # ---- pii filter ----
    anonymised_content: str

    # ---- categorize ----
    category: str | None
    category_confidence: float | None
    category_rationale: str | None

    # ---- audit ----
    trace: Annotated[list[TraceEvent], add]
