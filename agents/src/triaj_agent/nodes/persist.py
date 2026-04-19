"""Persist: write the final case or policy row to Supabase."""

from __future__ import annotations

from triaj_agent import supabase_client
from triaj_agent.state import CaseState


def persist(state: CaseState) -> CaseState:
    record_id = state.get("case_id", "unknown")
    documents = [d.source for d in (state.get("documents") or [])]

    if state.get("kind") == "policy":
        # raw_content goes on the row so categorize can load it back from the
        # policies table and present it to Claude as classification context.
        supabase_client.update_policy(
            record_id,
            status="indexed",
            raw_content=state.get("raw_content"),
            documents=documents,
        )
    else:
        # Move the case out of the frontend's "Processing" state by writing
        # all three status-axis columns. `case_created` is the first workflow
        # state in data/states.json, so caseworkers see a normal fresh case.
        # `ai_status='draft'` marks it as ready for human review.
        # The LLM's state-machine classification drives the row's `state`
        # column — the UI shows "Awaiting evidence" / "Under review" / etc.
        # matching what the AI said. Fall back to "case_created" when the
        # AI skipped (no policies, etc.) so the UI never shows a blank state.
        workflow_state = state.get("recommended_state") or "case_created"

        # `score` on the cases row is the AI's confidence in its
        # classification (0–100 scale, rescaled from the tool's 0.0–1.0
        # `confidence`). The tool's `priority` — the triage urgency — lives
        # only in the rationale banding and in case_notes JSON via extras.
        confidence = state.get("category_confidence")
        score = round(confidence * 100) if confidence is not None else None

        supabase_client.update_case(
            record_id,
            status="case_created",
            state=workflow_state,
            ai_status="draft",
            explanation=state.get("category_rationale"),
            category=state.get("category"),
            score=score,
            # Keep the raw 0.0–1.0 confidence and the separate priority
            # in case_notes JSON for audit — score is the rounded display
            # version the UI reads.
            category_confidence=state.get("category_confidence"),
            priority=state.get("priority"),
            triage_statement=state.get("triage_statement"),
            anonymised_content=state.get("anonymised_content"),
            documents=documents,
        )

    return {"trace": [{"node": "persist", "status": "ok"}]}
