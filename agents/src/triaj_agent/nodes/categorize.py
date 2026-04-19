"""Categorize (Claude-powered, iterative).

Reviews one policy per invocation. The graph routes back here via
`categorize_router` until the `policy_queue` is exhausted; on each pass the
model updates its running `triage_statement` and its current best-matching
policy. This keeps each LLM call bounded in size even when the policy
corpus is large — no single prompt has to fit every policy document.

The system prompt (instructions + state machine + anonymised complaint) is
stable across iterations, so we mark it `cache_control: ephemeral`. The
iteration-specific content (running statement, previous leader, next policy)
lives in the user message and is not cached.
"""

from __future__ import annotations

import json
import os
from functools import lru_cache

import anthropic

from triaj_agent import supabase_client
from triaj_agent.state import CaseState
from triaj_agent.tools.categorize import TRIAGE_ITERATION_TOOL, TriageIteration


@lru_cache(maxsize=1)
def _anthropic_client() -> anthropic.Anthropic:
    return anthropic.Anthropic()


_CATEGORIZE_MODEL = os.getenv("TRIAGE_MODEL", "claude-opus-4-6")


def _system_prompt(state_machine: dict | None, complaint: str) -> str:
    parts = [
        "You are the Triaj categorisation node. You review the "
        "institution's policies one at a time to classify a complaint and "
        "place it in the institution's workflow state machine. On each "
        "iteration you see (1) your current running triage statement, "
        "(2) your current best-matching policy, and (3) ONE new policy to "
        "review. Call `record_triage_iteration` exactly once per iteration.",
        "",
        "At every turn you MUST ask yourself:",
        "  - What is this complaint really about? (one sentence)",
        "  - Does the new policy apply? Is it a better fit than my current "
        "leader? Only switch leader if genuinely better.",
        "  - Which STATE in the workflow state machine should this case "
        "sit in? Read the `required_actions` of each state — pick the one "
        "whose actions still need doing. Be decisive: state the name and "
        "say WHY.",
        "  - What priority does the combination of policy severity + "
        "escalation_thresholds + outstanding required_actions justify?",
        "",
        "Your `rationale` must follow this STRICT format, max ~90 words:",
        "  Triage Result: <ONE policy_id> (<priority>) — <state_name>.",
        '  Decision based on: "<direct quote>" (<policy_id>). <one '
        "sentence tying the quote to the complaint's facts and the "
        "state's required_actions>.",
        "",
        "GOOD:",
        "  Triage Result: POL-CC-001 (78) — awaiting_evidence.",
        '  Decision based on: "Compliance checks must be acknowledged '
        'within 5 working days" (POL-CC-001). Both thresholds were '
        "breached on 2025-07-03 and evidence request is still outstanding.",
        "",
        "BAD (do NOT do this):",
        "  - Don't name supporting/ruled-out policies. ONE policy only.",
        "  - Don't hedge ('may', 'could', 'might').",
        "  - Don't run-on with semicolons or em-dashes.",
        "  - Don't narrate which policies didn't apply — just omit them.",
        "",
        "--- Complaint (anonymised) ---",
        complaint or "(empty)",
    ]
    if state_machine:
        parts.extend(
            [
                "",
                "--- Workflow state machine ---",
                "This is the institution's workflow. Use the `state` values "
                "under the matching `case_type` as the closed set of valid "
                "`recommended_state` answers. Use `escalation_thresholds`, "
                "`required_actions`, and `allowed_transitions` to justify "
                "priority and state placement.",
                json.dumps(state_machine, indent=2),
            ]
        )
    return "\n".join(parts)


def _iteration_message(
    triage_statement: str,
    prev_leader: dict,
    prev_recommended_state: str | None,
    policy: dict,
) -> str:
    leader_line = (
        "(none yet — first iteration)"
        if not prev_leader.get("policy_id")
        else (
            f"{prev_leader['policy_id']} "
            f"(confidence={prev_leader.get('confidence')}, "
            f"priority={prev_leader.get('priority')}, "
            f"recommended_state={prev_recommended_state or 'none'})\n"
            f"Rationale: {prev_leader.get('rationale')}"
        )
    )
    return "\n".join(
        [
            "--- Your current triage statement ---",
            triage_statement or "(none yet — first iteration)",
            "",
            "--- Your current leading policy ---",
            leader_line,
            "",
            "--- Next policy to review ---",
            f"[policy_id: {policy.get('policy_id')}]",
            policy.get("raw_content") or "",
        ]
    )


def categorize(state: CaseState) -> CaseState:
    policy_queue = state.get("policy_queue")

    # First entry — load the full policy corpus once and seed the queue.
    # Subsequent entries reuse whatever the router sent us back with.
    if policy_queue is None:
        all_policies = supabase_client.list_policy_documents()
        if not all_policies:
            return {
                "policy_queue": [],
                "triage_statement": "no policies ingested — nothing to match against",
                "category": None,
                "category_confidence": None,
                "category_rationale": None,
                "priority": None,
                "recommended_state": None,
                "trace": [
                    {
                        "node": "categorize",
                        "status": "skipped",
                        "message": "no policies ingested — nothing to match against",
                    }
                ],
            }
        policy_queue = all_policies

    # Defensive: router should never send us here with an empty queue.
    if not policy_queue:
        return {
            "policy_queue": [],
            "trace": [
                {
                    "node": "categorize",
                    "status": "skipped",
                    "message": "queue already empty on entry",
                }
            ],
        }

    current_policy, *remaining = policy_queue
    anonymised = (state.get("anonymised_content") or "").strip()
    state_machine = state.get("state_machine")
    triage_statement = state.get("triage_statement") or ""
    prev_recommended_state = state.get("recommended_state")
    prev_leader = {
        "policy_id": state.get("category"),
        "confidence": state.get("category_confidence"),
        "priority": state.get("priority"),
        "rationale": state.get("category_rationale"),
    }

    response = _anthropic_client().messages.create(
        model=_CATEGORIZE_MODEL,
        max_tokens=1024,
        system=[
            {
                "type": "text",
                "text": _system_prompt(state_machine, anonymised),
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[
            {
                "role": "user",
                "content": _iteration_message(
                    triage_statement,
                    prev_leader,
                    prev_recommended_state,
                    current_policy,
                ),
            }
        ],
        tools=[TRIAGE_ITERATION_TOOL],
        tool_choice={"type": "tool", "name": "record_triage_iteration"},
    )

    tool_use = next(
        (b for b in response.content if getattr(b, "type", None) == "tool_use"),
        None,
    )
    if tool_use is None:
        # Skip this policy but keep the loop going so one bad call doesn't
        # strand the rest of the queue.
        return {
            "policy_queue": remaining,
            "trace": [
                {
                    "node": "categorize",
                    "status": "error",
                    "message": (
                        f"model did not emit a tool_use block for "
                        f"'{current_policy.get('policy_id')}'"
                    ),
                }
            ],
        }

    result = TriageIteration.model_validate(tool_use.input)
    category = None if result.policy_id == "unclassified" else result.policy_id

    return {
        "policy_queue": remaining,
        "triage_statement": result.triage_statement,
        "category": category,
        "category_confidence": result.confidence,
        "category_rationale": result.rationale,
        "priority": result.priority,
        "recommended_state": result.recommended_state,
        "trace": [
            {
                "node": "categorize",
                "status": "ok",
                "message": (
                    f"reviewed '{current_policy.get('policy_id')}' "
                    f"(leading: '{result.policy_id}', "
                    f"confidence={result.confidence:.2f}, "
                    f"priority={result.priority}, "
                    f"state={result.recommended_state}); "
                    f"{len(remaining)} policies remaining"
                ),
            }
        ],
    }
