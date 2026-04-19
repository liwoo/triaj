"""Fetch case: read Storage location off the `cases` row.

The frontend's CreateCaseDialog writes `storage_bucket` and `folder_name`
onto the case row when it uploads the dossier, so the agent only needs a
`case_id` to find the files. This node runs before `extract` and populates
those fields on graph state.

Short-circuits in three situations — extract will fall back to whatever
input it already has (typically `local_path`):

- `kind != "case"` — policies don't live in the `cases` table
- `local_path` already set — caller gave us a dev/test escape hatch
- Supabase not configured or row missing — extract will surface the error
"""

from __future__ import annotations

from triaj_agent import supabase_client
from triaj_agent.state import CaseState


def fetch_case(state: CaseState) -> CaseState:
    kind = state.get("kind") or "case"
    if kind != "case":
        return {
            "trace": [
                {
                    "node": "fetch_case",
                    "status": "skipped",
                    "message": f"kind='{kind}' — no row to fetch",
                }
            ]
        }

    if state.get("local_path"):
        return {
            "trace": [
                {
                    "node": "fetch_case",
                    "status": "skipped",
                    "message": "local_path provided — skipping DB lookup",
                }
            ]
        }

    case_id = (state.get("case_id") or "").strip()
    if not case_id:
        return {
            "trace": [
                {
                    "node": "fetch_case",
                    "status": "error",
                    "message": "no case_id on state — cannot fetch case row",
                }
            ]
        }

    row = supabase_client.get_case(case_id)
    if not row:
        return {
            "trace": [
                {
                    "node": "fetch_case",
                    "status": "error",
                    "message": (
                        f"case '{case_id}' not found in cases table "
                        "(or Supabase not configured)"
                    ),
                }
            ]
        }

    bucket = (row.get("storage_bucket") or "").strip()
    folder = (row.get("folder_name") or "").strip()
    if not bucket or not folder:
        return {
            "trace": [
                {
                    "node": "fetch_case",
                    "status": "error",
                    "message": (
                        f"case '{case_id}' missing storage_bucket/folder_name "
                        "— cannot locate dossier in Storage"
                    ),
                }
            ]
        }

    return {
        "storage_bucket": bucket,
        "folder_name": folder,
        "trace": [
            {
                "node": "fetch_case",
                "status": "ok",
                "message": f"fetched case '{case_id}' → {bucket}/{folder}",
            }
        ],
    }
