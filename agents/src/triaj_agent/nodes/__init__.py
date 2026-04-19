"""LangGraph nodes for the ingestion pipeline.

Flow (per the design in CLAUDE.md §Intended Architecture, stages 2–5):

    extract → validate → (quarantine | pii_filter → categorize → persist)

Each node lives in its own module so it can be replaced as the real
components come online (on-prem PII filter, pgvector policy index,
Supabase client). This package re-exports every node so `graph.py` can
keep using `nodes.<name>` without caring about module layout.
"""

from triaj_agent.nodes.categorize import categorize
from triaj_agent.nodes.categorize_router import categorize_router
from triaj_agent.nodes.classify_ingestion_path import classify_ingestion_path
from triaj_agent.nodes.classify_upload import classify_upload
from triaj_agent.nodes.extract import extract
from triaj_agent.nodes.fetch_case import fetch_case
from triaj_agent.nodes.persist import persist
from triaj_agent.nodes.pii_filter import pii_filter
from triaj_agent.nodes.quarantine import quarantine
from triaj_agent.nodes.triage_decision import triage_decision
from triaj_agent.nodes.validate import validate

__all__ = [
    "categorize",
    "categorize_router",
    "classify_ingestion_path",
    "classify_upload",
    "extract",
    "fetch_case",
    "persist",
    "pii_filter",
    "quarantine",
    "triage_decision",
    "validate",
]
