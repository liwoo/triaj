"""LangGraph wiring for the Triaj ingestion pipeline.

Every conditional edge is preceded by a decision node so the decision is an
observable step, not hidden inside an edge function.

    START → classify_upload → extract → classify_ingestion_path
        │
        ├─ policy ─► embedding → enrichment_decision → persist → END
        │
        └─ case   ─► validate → triage_decision
                                │
                                ├─ quarantine → END
                                │
                                └─ pii_filter → embedding → enrichment_decision
                                                                │
                                                                ├─ categorize → persist → END
                                                                └─ persist → END

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

    workflow.add_node("classify_upload", nodes.classify_upload)
    workflow.add_node("extract", nodes.extract)
    workflow.add_node("classify_ingestion_path", nodes.classify_ingestion_path)
    workflow.add_node("validate", nodes.validate)
    workflow.add_node("triage_decision", nodes.triage_decision)
    workflow.add_node("quarantine", nodes.quarantine)
    workflow.add_node("pii_filter", nodes.pii_filter)
    workflow.add_node("embedding", nodes.embedding)
    workflow.add_node("enrichment_decision", nodes.enrichment_decision)
    workflow.add_node("categorize", nodes.categorize)
    workflow.add_node("persist", nodes.persist)

    workflow.add_edge(START, "classify_upload")
    workflow.add_conditional_edges(
        "classify_upload",
        nodes.route_by_upload_kind,
        {"case": "extract", "policy": "extract"},
    )
    workflow.add_edge("extract", "classify_ingestion_path")
    workflow.add_conditional_edges(
        "classify_ingestion_path",
        nodes.route_after_extract,
        {"validate": "validate", "embedding": "embedding"},
    )
    workflow.add_edge("validate", "triage_decision")
    workflow.add_conditional_edges(
        "triage_decision",
        nodes.route_after_triage,
        {"pii_filter": "pii_filter", "quarantine": "quarantine"},
    )
    workflow.add_edge("quarantine", END)
    workflow.add_edge("pii_filter", "embedding")
    workflow.add_edge("embedding", "enrichment_decision")
    workflow.add_conditional_edges(
        "enrichment_decision",
        nodes.route_after_enrichment,
        {"categorize": "categorize", "persist": "persist"},
    )
    workflow.add_edge("categorize", "persist")
    workflow.add_edge("persist", END)

    return workflow


graph = build_graph().compile()
