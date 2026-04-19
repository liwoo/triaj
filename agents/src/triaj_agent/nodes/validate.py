"""Validate: quarantine anything that isn't processable downstream."""

from __future__ import annotations

from triaj_agent.state import CaseState


def _upstream_error(state: CaseState) -> str | None:
    """Return the most recent upstream error message from the trace, if any.

    When content is empty we want the quarantine reason to name the real
    failure (fetch_case couldn't find the row, extract couldn't list the
    bucket, a loader raised) rather than the generic "no readable content"
    — that message is what the UI shows the caseworker, so it should point
    at a fixable condition.
    """

    errors = [
        t for t in (state.get("trace") or []) if t.get("status") == "error"
    ]
    if not errors:
        return None
    last = errors[-1]
    return f"{last.get('node', 'upstream')}: {last.get('message', 'unknown error')}"


def validate(state: CaseState) -> CaseState:
    content = (state.get("raw_content") or "").strip()

    if not content:
        upstream = _upstream_error(state)
        reason = (
            f"Pipeline error — {upstream}"
            if upstream
            else "No readable content extracted from the bucket folder."
        )
        return {
            "is_processable": False,
            "quarantine_reason": reason,
            "trace": [
                {
                    "node": "validate",
                    "status": "quarantined",
                    "message": (
                        f"empty content ({upstream})" if upstream else "empty content"
                    ),
                }
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
