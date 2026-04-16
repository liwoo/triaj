"""LangGraph nodes for the ingestion pipeline.

Flow (per the design in CLAUDE.md §Intended Architecture, stages 2–5):

    extract → validate → (quarantine | pii_filter → embedding → categorize → persist)

Nodes are deliberately small and do one thing so they can be replaced as the
real components come online (on-prem PII filter, pgvector policy index,
Supabase client).
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Literal
from urllib.parse import urlparse

from triaj_agent import supabase_stub
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


def extract(state: CaseState) -> CaseState:
    """Parse every file in the case folder with LangChain loaders.

    Supports local paths and `file://` URLs out of the box. Cloud schemes
    (`s3://`, `gs://`, `supabase://`) are recognised but currently return an
    error event — swap in the appropriate downloader when the real storage
    layer is wired up.
    """

    url = (state.get("bucket_url") or "").strip()
    if not url:
        return {
            "documents": [],
            "raw_content": "",
            "trace": [
                {"node": "extract", "status": "error", "message": "bucket_url missing"}
            ],
        }

    parsed = urlparse(url)
    if parsed.scheme in ("", "file"):
        path = Path(parsed.path or url).expanduser().resolve()
        if not path.is_dir():
            return {
                "documents": [],
                "raw_content": "",
                "trace": [
                    {
                        "node": "extract",
                        "status": "error",
                        "message": f"folder not found: {path}",
                    }
                ],
            }
        docs = _list_local_folder(path)
    else:
        return {
            "documents": [],
            "raw_content": "",
            "trace": [
                {
                    "node": "extract",
                    "status": "error",
                    "message": f"bucket scheme '{parsed.scheme}' not implemented — stub a downloader",
                }
            ],
        }

    raw = "\n\n".join(d.content for d in docs if d.content)
    return {
        "documents": docs,
        "raw_content": raw,
        "trace": [
            {
                "node": "extract",
                "status": "ok",
                "message": f"parsed {len(docs)} file(s), {len(raw)} chars",
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


def route_by_upload_kind(state: CaseState) -> Literal["case", "policy"]:
    """Top-of-graph branch on the `kind` flag.

    Surfaces the case-vs-policy distinction as the first decision in the graph
    so it is visible in Studio traces. Both branches currently lead to extract;
    the post-extract routers carry the actual divergence. Missing flag is
    treated as "case" — tighten this to raise once upstream callers always set
    `kind` explicitly.
    """

    return "policy" if state.get("kind") == "policy" else "case"


def route_after_extract(state: CaseState) -> Literal["validate", "embedding"]:
    """Policy folders skip validation/PII/categorize; cases take the full path."""

    return "embedding" if state.get("kind") == "policy" else "validate"


def route_after_validate(state: CaseState) -> Literal["pii_filter", "quarantine"]:
    return "pii_filter" if state.get("is_processable") else "quarantine"


def route_after_embedding(state: CaseState) -> Literal["categorize", "persist"]:
    """Policies persist straight after embedding; cases go through categorize first."""

    return "persist" if state.get("kind") == "policy" else "categorize"


# ---------------------------------------------------------------------------
# Quarantine (writes to Supabase and terminates)
# ---------------------------------------------------------------------------


def quarantine(state: CaseState) -> CaseState:
    supabase_stub.update_case(
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
# Embedding
# ---------------------------------------------------------------------------


def _embedding_model():
    from langchain_openai import OpenAIEmbeddings

    return OpenAIEmbeddings(model=os.getenv("EMBEDDING_MODEL", "text-embedding-3-small"))


def embedding(state: CaseState) -> CaseState:
    # Policy branch skips pii_filter, so fall back to raw_content.
    text = state.get("anonymised_content") or state.get("raw_content") or ""
    try:
        vec = _embedding_model().embed_query(text)
    except ImportError:
        return {
            "embedding": [],
            "trace": [
                {
                    "node": "embedding",
                    "status": "skipped",
                    "message": "langchain-openai not installed",
                }
            ],
        }
    return {
        "embedding": vec,
        "trace": [{"node": "embedding", "status": "ok", "message": f"dim={len(vec)}"}],
    }


# ---------------------------------------------------------------------------
# Categorize (stub — policy vectors TBD)
# ---------------------------------------------------------------------------


def categorize(state: CaseState) -> CaseState:
    """Match the case embedding against the institution's policy vectors.

    Real implementation: nearest-neighbour query against a pgvector table
    populated from the framework prompt bank, returning the best-matching
    case_type + similarity. Stubbed for now — categorize returns null until
    the policy vector index exists.
    """

    return {
        "category": None,
        "category_confidence": None,
        "trace": [
            {
                "node": "categorize",
                "status": "skipped",
                "message": "policy vector index not loaded",
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
        supabase_stub.update_policy(
            record_id,
            status="indexed",
            embedding=state.get("embedding"),
            documents=documents,
        )
    else:
        supabase_stub.update_case(
            record_id,
            status="triaged",
            category=state.get("category"),
            category_confidence=state.get("category_confidence"),
            embedding=state.get("embedding"),
            anonymised_content=state.get("anonymised_content"),
            documents=documents,
        )

    return {"trace": [{"node": "persist", "status": "ok"}]}
