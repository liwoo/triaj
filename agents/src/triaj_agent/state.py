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

    Minimal invocation input for a case: `case_id` (+ optional `kind` and
    `state_machine`). The `fetch_case` node reads the rest (`storage_bucket`,
    `folder_name`) off the `cases` row in Supabase. For dev and tests,
    `local_path` is an escape hatch that skips the DB lookup.

    Flow:
    - kind="case"   → fetch_case → extract → validate → (quarantine | pii_filter → categorize ⇄ router → persist)
    - kind="policy" → extract → persist (fetch_case is a no-op for policies)

    Quarantine and persist both write to Supabase (cases table for case kind,
    policies table for policy kind).
    """

    # ---- input ----
    case_id: str
    kind: Kind
    local_path: str    # dev/test escape hatch — skips the DB fetch
    # Institution-defined workflow state machine (shape varies per institution
    # and per case type — states, transitions, required_actions, escalation
    # thresholds, etc.). Passed through to categorize so the LLM can factor
    # escalation thresholds and outstanding actions into the priority score.
    # Typically the `data/states.json` structure: {case_types: {<type>: {states: [...]}}}.
    state_machine: dict

    # ---- fetch_case (populated from the cases row) ----
    storage_bucket: str    # Supabase Storage bucket holding the case folder
    folder_name: str       # prefix inside the bucket

    # ---- extract ----
    documents: list[ParsedDocument]
    raw_content: str

    # ---- validate ----
    is_processable: bool
    quarantine_reason: str | None

    # ---- pii filter ----
    anonymised_content: str

    # ---- categorize (iterative loop over policies) ----
    # One policy is reviewed per `categorize` invocation. The router node
    # `categorize_router` loops back to `categorize` while `policy_queue` is
    # non-empty, then routes to `persist`. `triage_statement` is the LLM's
    # running memory across iterations — each invocation rewrites it with
    # what it just learned from the newest policy.
    policy_queue: list[dict]
    triage_statement: str
    category: str | None
    category_confidence: float | None
    category_rationale: str | None
    priority: int | None
    # The state machine state the LLM believes this case should sit in
    # (from the relevant case_type's states). A recommendation, not an
    # auto-transition — persist stores it alongside the category for the
    # human reviewer to act on.
    recommended_state: str | None

    # ---- audit ----
    trace: Annotated[list[TraceEvent], add]
