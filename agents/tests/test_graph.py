"""Smoke tests for the ingestion graph.

End-to-end against real on-disk folders. The `categorize` node is monkey-
patched because it hits the real Anthropic API — a dedicated unit test
exercises it against a fake Anthropic client.
"""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

import pytest

import triaj_agent.graph as graph_module
from triaj_agent import nodes, supabase_client


@pytest.fixture(autouse=True)
def _reset_supabase(monkeypatch: pytest.MonkeyPatch) -> None:
    supabase_client.reset()
    monkeypatch.setattr(supabase_client, "_lazy_client", lambda: None)
    yield
    supabase_client.reset()


@pytest.fixture
def stub_categorize(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_categorize(state):
        return {
            "category": "policy-demo",
            "category_confidence": 0.82,
            "category_rationale": "stubbed match",
            "trace": [{"node": "categorize", "status": "ok", "message": "stubbed"}],
        }

    monkeypatch.setattr(nodes, "categorize", fake_categorize)
    monkeypatch.setattr(graph_module, "graph", graph_module.build_graph().compile())


def _write_folder(tmp_path: Path, files: dict[str, str]) -> Path:
    folder = tmp_path / "case-folder"
    folder.mkdir()
    for name, body in files.items():
        (folder / name).write_text(body)
    return folder


def test_processable_folder_runs_full_pipeline(
    tmp_path: Path, stub_categorize: None
) -> None:
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
        {"case_id": "CASE-INGEST-001", "local_path": str(folder)}
    )

    assert result["is_processable"] is True
    assert result["raw_content"]
    assert result["category"] == "policy-demo"
    assert result["category_confidence"] == 0.82
    trace_nodes = [t["node"] for t in result["trace"]]
    assert trace_nodes == [
        "classify_upload",
        "extract",
        "classify_ingestion_path",
        "validate",
        "triage_decision",
        "pii_filter",
        "categorize",
        "persist",
    ]

    writes = supabase_client.get_writes()
    assert len(writes) == 1
    row = writes[0]
    assert row["case_id"] == "CASE-INGEST-001"
    # All three status axes updated so UI moves off "Processing"
    assert row["status"] == "case_created"
    assert row["state"] == "case_created"
    assert row["ai_status"] == "draft"
    # Dedicated column for the rationale
    assert row["explanation"] == "stubbed match"
    assert "last_updated" in row
    # Fields without dedicated columns still ride in case_notes
    import json as _json

    notes = _json.loads(row["case_notes"])
    assert notes["category"] == "policy-demo"
    assert notes["category_confidence"] == 0.82


def test_empty_folder_is_quarantined(tmp_path: Path, stub_categorize: None) -> None:
    folder = tmp_path / "empty"
    folder.mkdir()

    result = graph_module.graph.invoke(
        {"case_id": "CASE-EMPTY", "local_path": str(folder)}
    )

    assert result["is_processable"] is False
    assert "No readable content" in result["quarantine_reason"]
    assert "category" not in result

    writes = supabase_client.get_writes()
    assert len(writes) == 1
    row = writes[0]
    assert row["case_id"] == "CASE-EMPTY"
    # All three axes set to quarantined so the UI bucket + workflow agree
    assert row["status"] == "quarantined"
    assert row["state"] == "quarantined"
    assert row["ai_status"] == "quarantined"
    assert (
        row["rejection_reason"]
        == "No readable content extracted from the bucket folder."
    )
    assert "Quarantined by pre-processing" in row["explanation"]


def test_missing_input_quarantines(stub_categorize: None) -> None:
    result = graph_module.graph.invoke({"case_id": "CASE-NO-INPUT"})

    assert result["is_processable"] is False
    assert supabase_client.get_writes()[0]["status"] == "quarantined"
    extract_trace = [t for t in result["trace"] if t["node"] == "extract"]
    assert "missing input" in extract_trace[0]["message"]


def test_policy_folder_persists_directly(
    tmp_path: Path, stub_categorize: None
) -> None:
    folder = _write_folder(
        tmp_path,
        {
            "section-1.1.md": (
                "1.1 Definition of urgent. A benefit review is urgent where loss of payment "
                "would, within 14 days, leave the applicant unable to meet essential living costs."
            ),
        },
    )

    result = graph_module.graph.invoke(
        {"case_id": "POLICY-2026-04", "local_path": str(folder), "kind": "policy"}
    )

    trace_nodes = [t["node"] for t in result["trace"]]
    assert trace_nodes == [
        "classify_upload",
        "extract",
        "classify_ingestion_path",
        "persist",
    ]

    assert supabase_client.get_writes() == []  # nothing in cases table
    policy_writes = supabase_client.get_policy_writes()
    assert len(policy_writes) == 1
    assert policy_writes[0]["policy_id"] == "POLICY-2026-04"
    assert policy_writes[0]["status"] == "indexed"
    assert "1.1 Definition of urgent" in policy_writes[0]["raw_content"]


def test_extract_downloads_from_supabase_storage(
    monkeypatch: pytest.MonkeyPatch, stub_categorize: None
) -> None:
    """Simulate the real production path: bucket + folder in state, files
    fetched via the Supabase client.
    """

    class _FakeStorage:
        def __init__(self) -> None:
            self.listed: list[str] = []
            self.downloaded: list[str] = []

        def list(self, path: str):
            self.listed.append(path)
            # frontend's manifest + one complaint file
            return [
                {"name": "case_data.json", "id": "obj-1"},
                {"name": "complaint.txt", "id": "obj-2"},
                {"name": "thumbnails", "id": None},  # subfolder — must be skipped
            ]

        def download(self, path: str) -> bytes:
            self.downloaded.append(path)
            if path.endswith("case_data.json"):
                return b'{"applicant": "[PERSON_1]"}'
            return b"The applicant is requesting a review of their housing benefit."

    store = _FakeStorage()

    class _FakeTable:
        """No-op stand-in so persist() can call .table(...).update(...).execute()."""

        def update(self, *_a, **_kw):
            return self

        def eq(self, *_a, **_kw):
            return self

        def execute(self):
            return None

    class _FakeClient:
        storage = type(
            "S", (), {"from_": staticmethod(lambda bucket: store)}
        )

        def table(self, _name):
            return _FakeTable()

    monkeypatch.setattr(supabase_client, "_lazy_client", lambda: _FakeClient())

    result = graph_module.graph.invoke(
        {
            "case_id": "CASE-INGEST-42",
            "bucket": "uploads-quarantine",
            "folder": "CASE-INGEST-42_jane-doe - benefit_review",
        }
    )

    assert result["is_processable"] is True
    assert "housing benefit" in result["raw_content"]
    assert store.listed == ["CASE-INGEST-42_jane-doe - benefit_review"]
    # Subfolder (id=None) was skipped; only the two real files were downloaded.
    assert len(store.downloaded) == 2
    assert all(
        p.startswith("CASE-INGEST-42_jane-doe - benefit_review/")
        for p in store.downloaded
    )
    assert "thumbnails" not in " ".join(store.downloaded)


def test_categorize_calls_anthropic_with_cached_policy_prompt(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Exercise the real categorize node against a fake Anthropic client."""

    # Seed one policy so categorize has something to classify against.
    supabase_client.update_policy(
        "POLICY-HOUSING-BENEFIT",
        status="indexed",
        raw_content="Housing benefit reviews are urgent when payment loss would cause hardship.",
        documents=["section-1.1.md"],
    )

    captured: dict = {}

    class _FakeToolUseBlock:
        type = "tool_use"
        name = "record_categorisation"
        input = {
            "policy_id": "POLICY-HOUSING-BENEFIT",
            "confidence": 0.91,
            "rationale": "Matches the housing benefit urgency clause.",
        }

    class _FakeMessages:
        def create(self, **kwargs):
            captured.update(kwargs)
            return SimpleNamespace(content=[_FakeToolUseBlock()])

    class _FakeClient:
        messages = _FakeMessages()

    nodes._anthropic_client.cache_clear()
    monkeypatch.setattr(nodes, "_anthropic_client", lambda: _FakeClient())

    update = nodes.categorize(
        {
            "case_id": "CASE-42",
            "anonymised_content": "The applicant's payment has stopped and rent is due.",
            "kind": "case",
        }
    )

    assert update["category"] == "POLICY-HOUSING-BENEFIT"
    assert update["category_confidence"] == 0.91
    assert "housing benefit" in update["category_rationale"].lower()

    # Confirm the policy prompt is cached, tool_choice forces the tool, model is right.
    system = captured["system"]
    assert system[0]["cache_control"] == {"type": "ephemeral"}
    assert "POLICY-HOUSING-BENEFIT" in system[0]["text"]
    assert captured["model"] == nodes._CATEGORIZE_MODEL
    assert captured["tool_choice"]["name"] == "record_categorisation"
    assert captured["tools"][0]["name"] == "record_categorisation"


def test_categorize_skips_when_no_policies_ingested() -> None:
    update = nodes.categorize(
        {"case_id": "CASE-X", "anonymised_content": "anything", "kind": "case"}
    )
    assert update["category"] is None
    assert update["category_confidence"] is None
    assert update["trace"][0]["status"] == "skipped"
