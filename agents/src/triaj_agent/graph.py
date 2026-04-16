"""LangGraph wiring for the Triaj ingestion pipeline.

Decision nodes return Command[Literal[...]] for every real branch so the
decision is an observable step, not hidden in an edge function.

    START → classify_upload → extract → classify_ingestion_path
                                            │
                                            ├─ policy ─► persist → END
                                            │
                                            └─ case   ─► validate → triage_decision
                                                                    │
                                                                    ├─ quarantine → END
                                                                    │
                                                                    └─ pii_filter → categorize → persist → END

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
    workflow.add_node("categorize", nodes.categorize)
    workflow.add_node("persist", nodes.persist)

    workflow.add_edge(START, "classify_upload")
    workflow.add_edge("classify_upload", "extract")
    workflow.add_edge("extract", "classify_ingestion_path")
    # classify_ingestion_path returns Command(goto=validate|persist)
    workflow.add_edge("validate", "triage_decision")
    # triage_decision returns Command(goto=pii_filter|quarantine)
    workflow.add_edge("pii_filter", "categorize")
    workflow.add_edge("categorize", "persist")
    workflow.add_edge("quarantine", END)
    workflow.add_edge("persist", END)

    return workflow


graph = build_graph().compile()
