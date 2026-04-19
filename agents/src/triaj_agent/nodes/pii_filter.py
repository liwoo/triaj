"""PII filter (stub).

The real implementation must run on-prem before any external model call
(README design principle 2). Until it is wired up, this passes content
through unchanged — do not point downstream nodes at a hosted model
until the real filter is in place.
"""

from __future__ import annotations

from triaj_agent.state import CaseState


def pii_filter(state: CaseState) -> CaseState:
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
