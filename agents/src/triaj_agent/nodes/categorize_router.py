"""Categorize router: loop back while policies remain, else persist.

    categorize → categorize_router ─┬─ policy_queue non-empty ─► categorize
                                    └─ policy_queue empty     ─► persist

`categorize` reviews one policy per invocation; this node is the "while
queue is non-empty" gate that keeps the loop going.
"""

from __future__ import annotations

from typing import Literal

from langgraph.types import Command

from triaj_agent.state import CaseState


def categorize_router(
    state: CaseState,
) -> Command[Literal["categorize", "persist"]]:
    queue = state.get("policy_queue") or []

    if queue:
        goto: Literal["categorize", "persist"] = "categorize"
        message = f"{len(queue)} policies remaining → loop back to categorize"
    else:
        goto = "persist"
        message = "all policies exhausted → continue to persist"

    return Command(
        update={
            "trace": [
                {"node": "categorize_router", "status": "ok", "message": message}
            ]
        },
        goto=goto,
    )
