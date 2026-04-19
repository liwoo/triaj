"""Anthropic tool schema for the iterative categorize loop.

`categorize` reviews one policy per invocation. On each iteration the model
sees its running triage statement + previous leading match + the next policy
+ the workflow state machine, and calls this tool with:

- its updated running statement (including state-machine placement thinking)
- the current best-matching policy + priority + confidence
- the state the case should sit in inside the institution's state machine
- a decisive `Triage Result: … / Decision made based on: …` rationale

Tool-use-for-structured-output: works on direct Anthropic, Bedrock, and
LiteLLM gateways, unlike `messages.parse(output_format=...)` which depends
on the newer structured-outputs API that Bedrock doesn't yet expose.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class TriageIteration(BaseModel):
    triage_statement: str = Field(
        description=(
            "Your running internal assessment. Update it each iteration with "
            "what you learned from the new policy. It MUST include: "
            "(1) what the complaint is about in one sentence, "
            "(2) which policies you have ruled in or out and why, "
            "(3) your current placement of the case in the workflow state "
            "machine — name the exact state and explain WHY that state fits "
            "given the required_actions and escalation_thresholds. "
            "Aim for 4–6 sentences. Be decisive, not hedging."
        )
    )
    policy_id: str = Field(
        description=(
            "ID of your CURRENT best-matching policy across every policy you "
            "have seen so far. Only switch away from your previous leader if "
            "the policy you just reviewed is a better fit. Use 'unclassified' "
            "if nothing matches."
        )
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Confidence in the current leader: 0.0 (no match) to 1.0 (perfect match).",
    )
    priority: int = Field(
        ge=0,
        le=100,
        description=(
            "Triage urgency for the current leader, 0–100. Anchor: 0–24 low, "
            "25–49 standard, 50–74 high, 75–100 urgent. Use the workflow "
            "state machine (escalation_thresholds, required_actions, "
            "allowed_transitions) to inform this. Be honest — reserve 75+ "
            "for real urgency."
        ),
    )
    recommended_state: str = Field(
        description=(
            "The state in the institution's workflow state machine that this "
            "case should currently sit in. Must be one of the `state` values "
            "defined under the matching `case_type` in the state machine "
            "(e.g., 'case_created', 'awaiting_evidence', 'under_review', "
            "'pending_decision', 'escalated', 'closed'). Choose the state "
            "whose `required_actions` best describe what still needs to "
            "happen on this case."
        )
    )
    rationale: str = Field(
        description=(
            "The final human-readable explanation. STRICT two-line format, "
            "max ~90 words total.\n\n"
            "Line 1 (exact template):\n"
            "  Triage Result: <ONE policy_id> (<priority>) — "
            "<state_name>.\n\n"
            "Line 2 (exact template):\n"
            "  Decision based on: \"<ONE direct quote from the policy>\" "
            "(<policy_id>). <ONE sentence tying the quote to the "
            "complaint's key facts and the state's required_actions>.\n\n"
            "RULES:\n"
            "- Name ONE leading policy on line 1. No 'supported by X and Y'.\n"
            "- NEVER mention policies you ruled out. If POL-XX doesn't "
            "apply, don't say so — just don't mention it.\n"
            "- No hedging ('may', 'could', 'might', 'would'). State the call.\n"
            "- No semicolons. No em-dash run-ons. Short sentences.\n\n"
            "GOOD example:\n"
            "  Triage Result: POL-CC-001 (78) — awaiting_evidence.\n"
            "  Decision based on: \"Compliance checks must be acknowledged "
            "within 5 working days and commenced within 20 working days\" "
            "(POL-CC-001). Both thresholds were breached on 2025-07-03 and "
            "evidence request + 28-day response window are still outstanding.\n\n"
            "BAD example (do NOT produce this):\n"
            "  Triage Result: POL-CC-001 (supported by POL-CC-002 and "
            "POL-CC-003) — urgent — compliance_check / awaiting_evidence.\n"
            "  Decision based on: POL-LA-003 is scoped to Licence "
            "Applications and has zero relevance; POL-CC-001 remains the "
            "controlling policy with both thresholds breached..."
        )
    )


TRIAGE_ITERATION_TOOL = {
    "name": "record_triage_iteration",
    "description": (
        "Update your running triage statement and record your current "
        "best-matching policy, recommended workflow state, and decisive "
        "rationale after reviewing the latest policy document. Call this "
        "tool exactly once per iteration."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "triage_statement": {
                "type": "string",
                "description": (
                    "Updated running assessment. Must cover: what the "
                    "complaint is about, which policies are ruled in/out, "
                    "and the case's placement in the workflow state machine "
                    "with reasoning. 4–6 sentences."
                ),
            },
            "policy_id": {
                "type": "string",
                "description": (
                    "ID of your current best-matching policy across all "
                    "policies reviewed so far. 'unclassified' if nothing "
                    "matches."
                ),
            },
            "confidence": {
                "type": "number",
                "minimum": 0.0,
                "maximum": 1.0,
                "description": "0.0 (no match) to 1.0 (perfect match).",
            },
            "priority": {
                "type": "integer",
                "minimum": 0,
                "maximum": 100,
                "description": (
                    "Triage urgency 0–100. 0–24 low, 25–49 standard, "
                    "50–74 high, 75–100 urgent. Use escalation_thresholds "
                    "and required_actions from the workflow state machine."
                ),
            },
            "recommended_state": {
                "type": "string",
                "description": (
                    "Exact `state` name from the relevant case_type's state "
                    "machine — the state whose required_actions best "
                    "describe what still needs to happen on this case."
                ),
            },
            "rationale": {
                "type": "string",
                "description": (
                    "STRICT two-line format. Line 1: 'Triage Result: "
                    "<ONE policy_id> (<priority>) — <state_name>.' "
                    "Line 2: 'Decision based on: \"<quote>\" (<policy_id>). "
                    "<one sentence tying quote to complaint facts>.' "
                    "NEVER mention ruled-out policies. No hedging. "
                    "Max ~90 words total."
                ),
            },
        },
        "required": [
            "triage_statement",
            "policy_id",
            "confidence",
            "priority",
            "recommended_state",
            "rationale",
        ],
    },
}
