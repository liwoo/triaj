"""Smoke tests for the ingestion graph.

The graph runs end-to-end against a real on-disk folder (pytest's tmp_path)
so the extract/validate/routing/Supabase paths are exercised without mocks.
The embedding node is patched to avoid network calls.
"""

from __future__ import annotations

from pathlib import Path

import pytest

import triaj_agent.graph as graph_module
from triaj_agent import nodes, supabase_stub


@pytest.fixture(autouse=True)
def _reset_supabase() -> None:
    supabase_stub.reset()
    yield
    supabase_stub.reset()


@pytest.fixture(autouse=True)
def _stub_embedding(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_embedding(state):
        return {
            "embedding": [0.01] * 8,
            "trace": [{"node": "embedding", "status": "ok", "message": "stubbed"}],
        }

    monkeypatch.setattr(nodes, "embedding", fake_embedding)
    monkeypatch.setattr(graph_module, "graph", graph_module.build_graph().compile())


def _write_folder(tmp_path: Path, files: dict[str, str]) -> Path:
    folder = tmp_path / "case-folder"
    folder.mkdir()
    for name, body in files.items():
        (folder / name).write_text(body)
    return folder


def test_processable_folder_runs_full_pipeline(tmp_path: Path) -> None:
    folder = _write_folder(
        tmp_path,
        {
            "complaint.txt": (
                "The applicant is requesting a review of their housing benefit decision "
                "issued on [DATE_1]. Supporting income statements were included."
            ),
            "notes.md": "Caseworker notes: follow-up call scheduled.",
        },
    )

    result = graph_module.graph.invoke(
        {"case_id": "CASE-INGEST-001", "bucket_url": str(folder)}
    )

    assert result["is_processable"] is True
    assert result["raw_content"]
    assert result["embedding"] == [0.01] * 8
    assert result["category"] is None  # categorize is still a stub
    trace_nodes = [t["node"] for t in result["trace"]]
    assert trace_nodes == [
        "classify_upload",
        "extract",
        "classify_ingestion_path",
        "validate",
        "triage_decision",
        "pii_filter",
        "embedding",
        "enrichment_decision",
        "categorize",
        "persist",
    ]

    writes = supabase_stub.get_writes()
    assert len(writes) == 1
    assert writes[0]["case_id"] == "CASE-INGEST-001"
    assert writes[0]["status"] == "triaged"
    assert writes[0]["embedding"] == [0.01] * 8


def test_empty_folder_is_quarantined(tmp_path: Path) -> None:
    folder = tmp_path / "empty"
    folder.mkdir()

    result = graph_module.graph.invoke(
        {"case_id": "CASE-EMPTY", "bucket_url": str(folder)}
    )

    assert result["is_processable"] is False
    assert "No readable content" in result["quarantine_reason"]
    assert "embedding" not in result

    writes = supabase_stub.get_writes()
    assert writes == [
        {
            "case_id": "CASE-EMPTY",
            "status": "quarantined",
            "reason": "No readable content extracted from the bucket folder.",
        }
    ]


def test_missing_bucket_url_quarantines() -> None:
    result = graph_module.graph.invoke({"case_id": "CASE-NO-URL", "bucket_url": ""})

    assert result["is_processable"] is False
    assert supabase_stub.get_writes()[0]["status"] == "quarantined"


def test_policy_folder_skips_to_embed_and_persist(tmp_path: Path) -> None:
    folder = _write_folder(
        tmp_path,
        {
            "section-1.1.md": (
                "1.1 Definition of urgent. A benefit review is urgent where loss of payment "
                "would, within 14 days, leave the applicant unable to meet essential living costs."
            ),
            "section-2.3.md": (
                "2.3 Vulnerability as a first-order escalation factor. Cases involving an "
                "applicant identified as vulnerable are escalated regardless of monetary value."
            ),
        },
    )

    result = graph_module.graph.invoke(
        {"case_id": "POLICY-2026-04", "bucket_url": str(folder), "kind": "policy"}
    )

    trace_nodes = [t["node"] for t in result["trace"]]
    assert trace_nodes == [
        "classify_upload",
        "extract",
        "classify_ingestion_path",
        "embedding",
        "enrichment_decision",
        "persist",
    ]
    assert result["embedding"] == [0.01] * 8

    assert supabase_stub.get_writes() == []  # nothing in cases table
    policy_writes = supabase_stub.get_policy_writes()
    assert len(policy_writes) == 1
    assert policy_writes[0]["policy_id"] == "POLICY-2026-04"
    assert policy_writes[0]["status"] == "indexed"
    assert policy_writes[0]["embedding"] == [0.01] * 8


def test_unsupported_scheme_quarantines() -> None:
    result = graph_module.graph.invoke(
        {"case_id": "CASE-S3", "bucket_url": "s3://bucket/case-001/"}
    )

    assert result["is_processable"] is False
    reason_trace = [t for t in result["trace"] if t["node"] == "extract"]
    assert "not implemented" in reason_trace[0]["message"]
