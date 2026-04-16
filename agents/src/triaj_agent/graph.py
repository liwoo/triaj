"""LangGraph wiring for the Triaj ingestion pipeline.

    START → extract ──► (kind=policy) ─► embedding → persist → END
                    │
                    └► (kind=case) ─► validate ──► pii_filter → embedding → categorize → persist → END
                                              │
                                              └► quarantine → END

Exposed as `graph` so that:
    - `langgraph dev` picks it up via langgraph.json
    - `from triaj_agent import graph` works for direct invocation
    - LangSmith tracing kicks in when LANGSMITH_TRACING=true
"""

from __future__ import annotations

from dotenv import load_dotenv
from langgraph.graph import END, START, StateGraph

from triaj_agent import nodes
from triaj_agent.state import CaseState

load_dotenv()


def build_graph() -> StateGraph:
    workflow = StateGraph(CaseState)

    workflow.add_node("extract", nodes.extract)
    workflow.add_node("validate", nodes.validate)
    workflow.add_node("quarantine", nodes.quarantine)
    workflow.add_node("pii_filter", nodes.pii_filter)
    workflow.add_node("embedding", nodes.embedding)
    workflow.add_node("categorize", nodes.categorize)
    workflow.add_node("persist", nodes.persist)

    workflow.add_conditional_edges(
        START,
        nodes.route_by_upload_kind,
        {"case": "extract", "policy": "extract"},
    )
    workflow.add_conditional_edges(
        "extract",
        nodes.route_after_extract,
        {"validate": "validate", "embedding": "embedding"},
    )
    workflow.add_conditional_edges(
        "validate",
        nodes.route_after_validate,
        {"pii_filter": "pii_filter", "quarantine": "quarantine"},
    )
    workflow.add_edge("quarantine", END)
    workflow.add_edge("pii_filter", "embedding")
    workflow.add_conditional_edges(
        "embedding",
        nodes.route_after_embedding,
        {"categorize": "categorize", "persist": "persist"},
    )
    workflow.add_edge("categorize", "persist")
    workflow.add_edge("persist", END)

    return workflow


graph = build_graph().compile()
