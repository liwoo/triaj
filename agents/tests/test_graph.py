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
from triaj_agent.nodes import categorize as categorize_module


@pytest.fixture(autouse=True)
def _reset_supabase(monkeypatch: pytest.MonkeyPatch) -> None:
    supabase_client.reset()
    monkeypatch.setattr(supabase_client, "_lazy_client", lambda: None)
    yield
    supabase_client.reset()


@pytest.fixture
def stub_categorize(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_categorize(state):
        # Set policy_queue=[] so the router exits on the next hop — the stub
        # represents "all policies reviewed, here is the final verdict".
        return {
            "policy_queue": [],
            "triage_statement": "stubbed triage statement",
            "category": "policy-demo",
            "category_confidence": 0.82,
            "category_rationale": "stubbed match",
            "priority": 42,
            "recommended_state": "under_review",
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
        "fetch_case",  # skipped because local_path is set
        "extract",
        "classify_ingestion_path",
        "validate",
        "triage_decision",
        "pii_filter",
        "categorize",
        "categorize_router",
        "persist",
    ]

    writes = supabase_client.get_writes()
    assert len(writes) == 1
    row = writes[0]
    assert row["case_id"] == "CASE-INGEST-001"
    # status stays on the top-level bucket; state reflects the AI's
    # workflow classification (stub returned "under_review").
    assert row["status"] == "case_created"
    assert row["state"] == "under_review"
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
        "fetch_case",  # skipped for kind=policy
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
    """Simulate the real production path: only `case_id` is passed in.

    `fetch_case` reads `storage_bucket` + `folder_name` off the `cases` row,
    and `extract` downloads the dossier from Supabase Storage using them.
    """

    expected_folder = "CASE-INGEST-42_jane-doe - benefit_review"

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
        """Stand-in for supabase.table('cases').

        Supports both the fetch_case select chain (select → eq → single →
        execute) and the persist update chain (update → eq → execute).
        """

        def select(self, *_a, **_kw):
            return self

        def update(self, *_a, **_kw):
            return self

        def eq(self, *_a, **_kw):
            return self

        def single(self):
            return self

        def execute(self):
            # Return the case row for fetch_case; harmless for update chains.
            return SimpleNamespace(
                data={
                    "case_type": "benefit_review",
                    "storage_bucket": "uploads-quarantine",
                    "folder_name": expected_folder,
                }
            )

    class _FakeClient:
        storage = type(
            "S", (), {"from_": staticmethod(lambda bucket: store)}
        )

        def table(self, _name):
            return _FakeTable()

    monkeypatch.setattr(supabase_client, "_lazy_client", lambda: _FakeClient())

    result = graph_module.graph.invoke({"case_id": "CASE-INGEST-42"})

    # fetch_case populated the locator fields from the case row.
    assert result["storage_bucket"] == "uploads-quarantine"
    assert result["folder_name"] == expected_folder

    assert result["is_processable"] is True
    assert "housing benefit" in result["raw_content"]
    assert store.listed == [expected_folder]
    # Subfolder (id=None) was skipped; only the two real files were downloaded.
    assert len(store.downloaded) == 2
    assert all(p.startswith(f"{expected_folder}/") for p in store.downloaded)
    assert "thumbnails" not in " ".join(store.downloaded)


def test_categorize_reviews_one_policy_per_call_and_drains_queue(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Exercise the iterative categorize loop against a fake Anthropic client.

    Seeds two policies, runs `categorize` twice, and confirms the queue shrinks
    by one each pass — so a real run would naturally loop via the router until
    empty.
    """

    supabase_client.update_policy(
        "POLICY-HOUSING-BENEFIT",
        status="indexed",
        raw_content="Housing benefit reviews are urgent when payment loss would cause hardship.",
        documents=["section-1.1.md"],
    )
    supabase_client.update_policy(
        "POLICY-LICENCE",
        status="indexed",
        raw_content="Licence applications follow a 28-day consultation window.",
        documents=["section-2.1.md"],
    )

    captured_calls: list[dict] = []

    class _FakeToolUseBlock:
        type = "tool_use"
        name = "record_triage_iteration"
        input = {
            "triage_statement": (
                "Complaint is about a housing benefit stoppage. Place in "
                "awaiting_evidence — applicant's payment documentation is "
                "still outstanding."
            ),
            "policy_id": "POLICY-HOUSING-BENEFIT",
            "confidence": 0.91,
            "priority": 78,
            "recommended_state": "awaiting_evidence",
            "rationale": (
                "Triage Result: URGENT benefit_review under "
                "POL-HOUSING-BENEFIT; place in awaiting_evidence.\n"
                "Decision made based on: 'Housing benefit reviews are "
                "urgent when payment loss would cause hardship' — applicant "
                "reports rent due and payment stopped, which triggers the "
                "28-day escalation threshold."
            ),
        }

    class _FakeMessages:
        def create(self, **kwargs):
            captured_calls.append(kwargs)
            return SimpleNamespace(content=[_FakeToolUseBlock()])

    class _FakeClient:
        messages = _FakeMessages()

    categorize_module._anthropic_client.cache_clear()
    monkeypatch.setattr(categorize_module, "_anthropic_client", lambda: _FakeClient())

    state_machine = {
        "case_types": {
            "benefit_review": {
                "states": [
                    {
                        "state": "awaiting_evidence",
                        "escalation_thresholds": {"escalation_days": 56},
                    }
                ]
            }
        }
    }

    # First iteration — policy_queue not yet in state, so categorize seeds it
    # from the policy corpus and reviews the first policy.
    first = nodes.categorize(
        {
            "case_id": "CASE-42",
            "anonymised_content": "The applicant's payment has stopped and rent is due.",
            "kind": "case",
            "state_machine": state_machine,
        }
    )

    assert first["category"] == "POLICY-HOUSING-BENEFIT"
    assert first["category_confidence"] == 0.91
    assert first["priority"] == 78
    assert first["recommended_state"] == "awaiting_evidence"
    assert first["category_rationale"].startswith("Triage Result:")
    assert "Decision made based on:" in first["category_rationale"]
    assert first["triage_statement"].startswith("Complaint is about")
    # One of the two seeded policies has been consumed.
    assert len(first["policy_queue"]) == 1

    # System prompt (cached) carries instructions + state machine + complaint.
    call = captured_calls[0]
    system = call["system"]
    assert system[0]["cache_control"] == {"type": "ephemeral"}
    assert "Workflow state machine" in system[0]["text"]
    assert "escalation_days" in system[0]["text"]
    assert "payment has stopped" in system[0]["text"]
    # Policy-under-review is now in the user message, not the system block.
    assert "POLICY-HOUSING-BENEFIT" not in system[0]["text"]
    user_content = call["messages"][0]["content"]
    assert "POLICY-HOUSING-BENEFIT" in user_content
    assert "first iteration" in user_content  # no leader / statement yet

    assert call["model"] == categorize_module._CATEGORIZE_MODEL
    assert call["tool_choice"]["name"] == "record_triage_iteration"
    assert call["tools"][0]["name"] == "record_triage_iteration"

    # Second iteration — the router would call categorize again with the
    # shrunken queue and the previous leader already recorded in state.
    second = nodes.categorize(
        {
            "case_id": "CASE-42",
            "anonymised_content": "The applicant's payment has stopped and rent is due.",
            "kind": "case",
            "state_machine": state_machine,
            "policy_queue": first["policy_queue"],
            "triage_statement": first["triage_statement"],
            "category": first["category"],
            "category_confidence": first["category_confidence"],
            "category_rationale": first["category_rationale"],
            "priority": first["priority"],
            "recommended_state": first["recommended_state"],
        }
    )

    assert second["policy_queue"] == []  # queue drained — router will exit
    # The iteration message carried the previous leader + recommended_state through.
    user_content_2 = captured_calls[1]["messages"][0]["content"]
    assert "POLICY-HOUSING-BENEFIT" in user_content_2
    assert "POLICY-LICENCE" in user_content_2  # the new policy being reviewed
    assert "awaiting_evidence" in user_content_2  # previous recommended_state threaded through


def test_categorize_skips_when_no_policies_ingested() -> None:
    update = nodes.categorize(
        {"case_id": "CASE-X", "anonymised_content": "anything", "kind": "case"}
    )
    assert update["category"] is None
    assert update["category_confidence"] is None
    assert update["recommended_state"] is None
    # Empty queue so the router routes straight to persist.
    assert update["policy_queue"] == []
    assert update["trace"][0]["status"] == "skipped"
