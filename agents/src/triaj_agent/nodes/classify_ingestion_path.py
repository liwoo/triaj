"""Classify ingestion path: case → full pipeline, policy → persist."""

from __future__ import annotations

from typing import Literal

from langgraph.types import Command

from triaj_agent.state import CaseState


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
