"""Quarantine: write the rejection to Supabase and terminate."""

from __future__ import annotations

from triaj_agent import supabase_client
from triaj_agent.state import CaseState


def quarantine(state: CaseState) -> CaseState:
    reason = state.get("quarantine_reason") or "unspecified"
    # Write all three status fields so the UI actually moves off "Processing":
    # `state='processing'` is the insert-time value; the frontend keeps showing
    # "Processing" until the agent replaces it with a terminal state.
    supabase_client.update_case(
        state.get("case_id", "unknown"),
        status="quarantined",
        state="quarantined",
        ai_status="quarantined",
        rejection_reason=reason,
        explanation=f"Quarantined by pre-processing: {reason}",
    )
    return {
        "trace": [
            {
                "node": "quarantine",
                "status": "quarantined",
                "message": reason,
            }
        ]
    }
