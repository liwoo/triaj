"""Classify upload: record the upload kind in the trace.

Plain node (no Command) because START → classify_upload → extract doesn't
actually branch — the downstream `classify_ingestion_path` is where the
case/policy split happens.
"""

from __future__ import annotations

from triaj_agent.state import CaseState


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
