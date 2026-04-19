"""Triage decision: processable cases continue to PII; rest quarantine."""

from __future__ import annotations

from typing import Literal

from langgraph.types import Command

from triaj_agent.state import CaseState


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
