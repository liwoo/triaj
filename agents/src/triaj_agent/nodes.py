"""LangGraph nodes for the ingestion pipeline.

Flow (per the design in CLAUDE.md §Intended Architecture, stages 2–5):

    extract → validate → (quarantine | pii_filter → embedding → categorize → persist)

Nodes are deliberately small and do one thing so they can be replaced as the
real components come online (on-prem PII filter, pgvector policy index,
Supabase client).
"""

from __future__ import annotations

import os
import shutil
import tempfile
from functools import lru_cache
from pathlib import Path
from typing import Literal

import anthropic
from langgraph.types import Command
from pydantic import BaseModel, Field

from triaj_agent import supabase_client
from triaj_agent.state import CaseState, ParsedDocument


# ---------------------------------------------------------------------------
# Extract
# ---------------------------------------------------------------------------

_TEXT_EXTS = {".txt", ".md", ".log", ".eml", ".csv", ".json"}


def _load_file(path: Path) -> list[ParsedDocument]:
    ext = path.suffix.lower()
    try:
        if ext == ".pdf":
            from langchain_community.document_loaders import PyPDFLoader

            loader = PyPDFLoader(str(path))
        elif ext in {".docx", ".doc"}:
            from langchain_community.document_loaders import Docx2txtLoader

            loader = Docx2txtLoader(str(path))
        elif ext in _TEXT_EXTS or ext == "":
            from langchain_community.document_loaders import TextLoader

            loader = TextLoader(str(path), autodetect_encoding=True)
        else:
            return [
                ParsedDocument(
                    source=str(path),
                    content="",
                    metadata={"skipped": True, "reason": f"unsupported extension {ext}"},
                )
            ]
    except ImportError as e:
        raise RuntimeError(
            f"Missing LangChain loader dependency for '{ext}' files: {e}"
        ) from e

    return [
        ParsedDocument(source=str(path), content=d.page_content, metadata=dict(d.metadata))
        for d in loader.load()
    ]


def _list_local_folder(path: Path) -> list[ParsedDocument]:
    docs: list[ParsedDocument] = []
    for f in sorted(path.rglob("*")):
        if f.is_file():
            docs.extend(_load_file(f))
    return docs


def _download_supabase_folder(bucket: str, folder: str) -> Path:
    """Download every file at `{bucket}/{folder}` into a fresh temp dir.

    Uses the shared Supabase client (credentials from SUPABASE_URL /
    SUPABASE_ANON_KEY). Flat listing only — subfolders are skipped, matching
    the frontend's upload shape (`uploads-quarantine/{folder}/file.ext`).
    """

    client = supabase_client._lazy_client()
    if client is None:
        raise RuntimeError(
            "SUPABASE_URL / SUPABASE_ANON_KEY not set — cannot reach Storage"
        )

    storage = client.storage.from_(bucket)
    items = storage.list(folder) or []
    files = [
        item for item in items if item.get("name") and item.get("id") is not None
    ]
    if not files:
        raise RuntimeError(f"no files found at '{bucket}/{folder}'")

    tmp = Path(tempfile.mkdtemp(prefix="triaj-extract-"))
    for item in files:
        name = item["name"]
        data = storage.download(f"{folder}/{name}")
        (tmp / name).write_bytes(data)
    return tmp


def _extract_error(message: str) -> CaseState:
    return {
        "documents": [],
        "raw_content": "",
        "trace": [{"node": "extract", "status": "error", "message": message}],
    }


def extract(state: CaseState) -> CaseState:
    """Parse every file in the case folder with LangChain loaders.

    Pulls from Supabase Storage (`bucket` + `folder`) or from the local
    filesystem (`local_path`). Exactly one must be set.
    """

    local = (state.get("local_path") or "").strip()
    bucket = (state.get("bucket") or "").strip()
    folder = (state.get("folder") or "").strip()

    source: str
    cleanup: Path | None = None

    if local:
        path = Path(local).expanduser().resolve()
        if not path.is_dir():
            return _extract_error(f"local folder not found: {path}")
        source = str(path)
    elif bucket and folder:
        try:
            path = _download_supabase_folder(bucket, folder)
        except Exception as e:
            return _extract_error(f"supabase download failed: {e}")
        source = f"supabase://{bucket}/{folder}"
        cleanup = path
    else:
        return _extract_error(
            "missing input: set `local_path`, or `bucket` + `folder`"
        )

    try:
        docs = _list_local_folder(path)
    finally:
        if cleanup is not None:
            shutil.rmtree(cleanup, ignore_errors=True)

    raw = "\n\n".join(d.content for d in docs if d.content)
    return {
        "documents": docs,
        "raw_content": raw,
        "trace": [
            {
                "node": "extract",
                "status": "ok",
                "message": f"parsed {len(docs)} file(s) from {source}, {len(raw)} chars",
            }
        ],
    }


# ---------------------------------------------------------------------------
# Validate
# ---------------------------------------------------------------------------


def validate(state: CaseState) -> CaseState:
    content = (state.get("raw_content") or "").strip()

    if not content:
        return {
            "is_processable": False,
            "quarantine_reason": "No readable content extracted from the bucket folder.",
            "trace": [
                {"node": "validate", "status": "quarantined", "message": "empty content"}
            ],
        }

    if len(content) < 40:
        return {
            "is_processable": False,
            "quarantine_reason": "Content below minimum length for triage (likely incomplete submission).",
            "trace": [
                {
                    "node": "validate",
                    "status": "quarantined",
                    "message": "below minimum length",
                }
            ],
        }

    return {
        "is_processable": True,
        "trace": [{"node": "validate", "status": "ok"}],
    }


# ---------------------------------------------------------------------------
# Decision nodes
#
# Every real branch in the graph is a node that returns Command[Literal[...]].
# The Command bundles the state update (trace event) and the `goto` that
# selects the next node, so the decision, its rationale, and the route all
# live in one function — no paired router or add_conditional_edges.
# classify_upload is a plain node because START → classify_upload → extract
# doesn't actually branch; it only records the kind in the trace.
# ---------------------------------------------------------------------------


def classify_upload(state: CaseState) -> CaseState:
    kind = state.get("kind") or "case"
    return {
        "trace": [
            {
                "node": "classify_upload",
                "status": "ok",
                "message": f"upload kind resolved as '{kind}'",
            }
        ]
    }


def classify_ingestion_path(
    state: CaseState,
) -> Command[Literal["validate", "persist"]]:
    kind = state.get("kind") or "case"
    if kind == "policy":
        goto: Literal["validate", "persist"] = "persist"
        message = "policy → persist directly (no validation, PII, or categorize)"
    else:
        goto = "validate"
        message = "case → full pipeline starting at validate"
    return Command(
        update={
            "trace": [
                {"node": "classify_ingestion_path", "status": "ok", "message": message}
            ]
        },
        goto=goto,
    )


def triage_decision(
    state: CaseState,
) -> Command[Literal["pii_filter", "quarantine"]]:
    if state.get("is_processable"):
        goto: Literal["pii_filter", "quarantine"] = "pii_filter"
        message = "content passed validation → continue to PII filter"
    else:
        goto = "quarantine"
        message = f"quarantine: {state.get('quarantine_reason') or 'unspecified'}"
    return Command(
        update={"trace": [{"node": "triage_decision", "status": "ok", "message": message}]},
        goto=goto,
    )


# ---------------------------------------------------------------------------
# Quarantine (writes to Supabase and terminates)
# ---------------------------------------------------------------------------


def quarantine(state: CaseState) -> CaseState:
    supabase_client.update_case(
        state.get("case_id", "unknown"),
        status="quarantined",
        reason=state.get("quarantine_reason"),
    )
    return {
        "trace": [
            {
                "node": "quarantine",
                "status": "quarantined",
                "message": state.get("quarantine_reason") or "unspecified",
            }
        ]
    }


# ---------------------------------------------------------------------------
# PII filter (stub)
# ---------------------------------------------------------------------------


def pii_filter(state: CaseState) -> CaseState:
    """Stub on-prem PII filtering pipeline (Presidio → GLiNER → local LLM).

    The real implementation must run on-prem before any external model call
    (README design principle 2). Until it is wired up, this passes content
    through unchanged — do not point downstream nodes at a hosted model
    until the real filter is in place.
    """

    return {
        "anonymised_content": state.get("raw_content", ""),
        "trace": [
            {
                "node": "pii_filter",
                "status": "skipped",
                "message": "stub — replace with Presidio/GLiNER/local-LLM pipeline",
            }
        ],
    }


# ---------------------------------------------------------------------------
# Categorize (Claude-powered)
#
# Claude does its own retrieval inside the prompt — we pass every ingested
# policy as context and it picks the best match. No embedding/pgvector step.
# The policy block is stable across cases so we cache it via prompt caching
# (~90% savings on input tokens after the first warm request).
# ---------------------------------------------------------------------------


class _Categorization(BaseModel):
    policy_id: str = Field(
        description="ID of the best-matching policy, or 'unclassified' if no policy fits."
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Confidence from 0.0 (no match) to 1.0 (perfect match).",
    )
    rationale: str = Field(
        description="Short explanation that quotes the matched policy where possible."
    )


@lru_cache(maxsize=1)
def _anthropic_client() -> anthropic.Anthropic:
    return anthropic.Anthropic()


_CATEGORIZE_MODEL = os.getenv("TRIAGE_MODEL", "claude-opus-4-6")


def _policy_system_prompt(policies: list[dict]) -> str:
    policy_block = "\n\n---\n\n".join(
        f"[policy_id: {p.get('policy_id')}]\n{p.get('raw_content') or ''}"
        for p in policies
    )
    return (
        "You are the Triaj categorisation node. Classify the anonymised "
        "complaint against the institution's policies below. Pick the best-matching "
        "policy_id, a confidence score from 0.0 to 1.0, and a short rationale that "
        "quotes the relevant text where possible. If nothing matches well, return "
        "policy_id='unclassified' with low confidence.\n\n"
        "--- Policies ---\n"
        f"{policy_block}"
    )


def categorize(state: CaseState) -> CaseState:
    policies = supabase_client.get_policy_writes()
    anonymised = (state.get("anonymised_content") or "").strip()

    if not policies:
        return {
            "category": None,
            "category_confidence": None,
            "category_rationale": None,
            "trace": [
                {
                    "node": "categorize",
                    "status": "skipped",
                    "message": "no policies ingested — nothing to match against",
                }
            ],
        }

    response = _anthropic_client().messages.parse(
        model=_CATEGORIZE_MODEL,
        max_tokens=1024,
        system=[
            {
                "type": "text",
                "text": _policy_system_prompt(policies),
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": anonymised}],
        output_format=_Categorization,
    )

    result: _Categorization = response.parsed_output
    category = None if result.policy_id == "unclassified" else result.policy_id

    return {
        "category": category,
        "category_confidence": result.confidence,
        "category_rationale": result.rationale,
        "trace": [
            {
                "node": "categorize",
                "status": "ok",
                "message": (
                    f"matched '{result.policy_id}' "
                    f"(confidence={result.confidence:.2f}): {result.rationale}"
                ),
            }
        ],
    }


# ---------------------------------------------------------------------------
# Persist (writes to Supabase and terminates)
# ---------------------------------------------------------------------------


def persist(state: CaseState) -> CaseState:
    record_id = state.get("case_id", "unknown")
    documents = [d.source for d in (state.get("documents") or [])]

    if state.get("kind") == "policy":
        # raw_content goes on the row so categorize can load it back from the
        # policies table and present it to Claude as classification context.
        supabase_client.update_policy(
            record_id,
            status="indexed",
            raw_content=state.get("raw_content"),
            documents=documents,
        )
    else:
        supabase_client.update_case(
            record_id,
            status="triaged",
            category=state.get("category"),
            category_confidence=state.get("category_confidence"),
            category_rationale=state.get("category_rationale"),
            anonymised_content=state.get("anonymised_content"),
            documents=documents,
        )

    return {"trace": [{"node": "persist", "status": "ok"}]}
