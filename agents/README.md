# Triaj agent

LangGraph ingestion pipeline: take a folder of complaint files, extract text, validate, PII-filter, categorise against the institution's policies, and persist the result to Supabase.

## Where's `main.py`?

There isn't one — and in LangGraph projects there usually isn't. A LangGraph app is a **compiled graph object** (`graph`) that you invoke, not a script you run top-to-bottom. The entry point lives in `src/triaj_agent/graph.py`, and `langgraph.json` tells the LangGraph CLI where to find it:

```json
{ "graphs": { "triage": "./src/triaj_agent/graph.py:graph" } }
```

There are three ways to run it, in increasing order of "I want a `main.py`":

1. **`langgraph dev`** — the LangGraph Studio UI, the usual dev workflow.
2. **Python one-liner** — `from triaj_agent import graph; graph.invoke(...)`.
3. **Your own runner script** — a ~10-line `run.py` you write yourself (example below).

## Prerequisites

- Python 3.11+
- An Anthropic API key (the `categorize` node calls Claude)
- *(Optional)* Supabase project with a `cases` table, a `policy-documents` storage bucket, and an `uploads-quarantine` storage bucket. Without it the agent runs in in-memory mode — writes land in a list, reads come from in-process state. Good enough to exercise the graph end-to-end.
- *(Optional)* LangSmith account for traces.

## Setup

From this directory (`agents/`):

```bash
# Create and activate a virtualenv
python -m venv .venv
source .venv/bin/activate

# Install the package plus the dev extras (langgraph CLI, pytest, ruff)
pip install -e ".[dev]"

# Copy the env template and fill it in
cp .env.example .env
```

Minimum fields to set in `.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
# Optional but recommended:
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
LANGSMITH_API_KEY=lsv2_pt_...
```

## Running the graph

### 1. LangGraph Studio (recommended for first run)

```bash
langgraph dev
```

This starts a local server at `http://localhost:2024` and opens Studio in your browser. You'll see the graph as a node diagram; click **+ New Run** and pass an input like:

```json
{
  "case_id": "CASE-DEMO-001",
  "kind": "case",
  "local_path": "/absolute/path/to/a/case-folder",
  "state_machine": {
    "case_types": {
      "benefit_review": {
        "states": [
          {
            "state": "case_created",
            "allowed_transitions": ["awaiting_evidence", "under_review"],
            "required_actions": ["Confirm applicant identity against records"]
          }
        ]
      }
    }
  }
}
```

`state_machine` is optional — pass the institution's workflow definition (same shape as `data/states.json`) so the categorize node can factor escalation thresholds and outstanding required actions into the priority score. Shape is not enforced; the raw JSON is shown to the model.

Studio streams each node's output as it executes, which is the fastest way to understand the flow.

### 2. Programmatic invocation (the "main.py equivalent")

```bash
python -c "
from triaj_agent import graph

result = graph.invoke({
    'case_id': 'CASE-DEMO-001',
    'kind': 'case',
    'local_path': '/absolute/path/to/a/case-folder',
})

for event in result['trace']:
    print(event['node'], '→', event.get('message', event['status']))
print('Category:', result.get('category'))
print('Priority:', result.get('priority'))
"
```

If you really want a `main.py`, drop this in the project root:

```python
# main.py
import sys
from triaj_agent import graph

result = graph.invoke({
    "case_id": sys.argv[1],
    "kind": "case",
    "local_path": sys.argv[2],
})
print(result)
```

Then `python main.py CASE-001 /path/to/folder`.

### 3. Ingesting a policy (not a case)

Policies skip validation, PII filtering, and categorisation — they go straight to `persist` and become part of the corpus that future `categorize` calls match against:

```python
graph.invoke({
    "case_id": "POLICY-HOUSING-2026-04",
    "kind": "policy",
    "local_path": "/path/to/policy-doc-folder",
})
```

### 4. Production path: just the `case_id`

The frontend writes `storage_bucket` and `folder_name` onto the `cases` row when it uploads the dossier, so the agent only needs a `case_id`:

```python
graph.invoke({"case_id": "CASE-INGEST-42"})
```

The `fetch_case` node reads those two columns off the row and hands them to `extract`, which downloads the dossier from Supabase Storage. `local_path` (above) is only needed when you're driving the graph by hand without a database.

## Running the tests

```bash
pytest
```

`tests/test_graph.py` is the most complete usage example in the repo — it exercises the full pipeline against on-disk fixtures, stubs out Supabase, and shows how to unit-test `categorize` against a fake Anthropic client.

## What the graph does

```
START
  └─► classify_upload
        └─► fetch_case            (reads storage_bucket + folder_name off the cases row)
              └─► extract
                    └─► classify_ingestion_path
                          ├─ kind=policy ─► persist ─► END
                          └─ kind=case   ─► validate
                                              └─► triage_decision
                                                    ├─ not processable ─► quarantine ─► END
                                                    └─ processable     ─► pii_filter
                                                                          └─► categorize
                                                                                └─► categorize_router
                                                                                      ├─ policies left ─► categorize (loop)
                                                                                      └─ exhausted    ─► persist ─► END
```

`categorize` reviews **one policy per invocation**, carrying forward a running `triage_statement` and the current best-matching policy. `categorize_router` loops the graph back to `categorize` until the `policy_queue` is empty, at which point the final leader is persisted. This keeps each LLM call bounded in size even when the policy corpus is long.

Each node lives in its own file under `src/triaj_agent/nodes/`. Tool schemas passed to Claude live under `src/triaj_agent/tools/`. The pipeline writes three things to the `cases` row at the end: the triage `status` / `state` / `ai_status`, the matched `category` + `score` (0–100 priority), and the framework-quoted `explanation`.

## Troubleshooting

**`ModuleNotFoundError: No module named 'triaj_agent'`** — you forgot `pip install -e .` or aren't in the activated venv.

**`langgraph: command not found`** — install the dev extras: `pip install -e ".[dev]"`.

**Categorize returns `None` with a "no policies ingested" trace** — run the graph with `kind=policy` at least once (or upload a file to the `policy-documents` bucket) before running it with `kind=case`. Without any policies there's nothing to classify against.

**Supabase env unset → in-memory mode** — this is intentional. If `SUPABASE_URL` / `SUPABASE_ANON_KEY` aren't set, writes go to `supabase_client._CASE_WRITES` instead of the real table, so the graph still runs end-to-end for local dev and tests. Inspect with `supabase_client.get_writes()`.
