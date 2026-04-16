# Schema Changelog — UI ↔ Backend Alignment

> Context: the frontend UI shell is now feature-complete against the README's design brief (triage grid, case detail modal, required-action surfacing, explainability panel). The current Supabase `cases` table is missing fields the UI already reads. This document lists the deltas needed before we wire the frontend to real data.
>
> **Audience:** backend engineer owning the Supabase schema + migrations.
> **Source of truth for UI shape:** `frontend/src/types.ts`.

---

## 1. `cases` — columns to add

Current schema (as-is):

| Column         | Type         | Notes                  |
|----------------|--------------|------------------------|
| id             | uuid         | PK                     |
| case_id        | text         | unique, non-null       |
| case_type      | text         | non-null               |
| status         | text         | non-null               |
| applicant_id   | uuid         | FK, nullable           |
| assigned_to    | text         | nullable               |
| case_notes     | text         | nullable               |
| created_date   | date         | non-null               |
| last_updated   | timestamptz  | nullable               |
| created_at     | timestamptz  | nullable               |

### Add these columns

| Column               | Type          | Nullable | Purpose |
|----------------------|---------------|----------|---------|
| `state`              | text          | no       | Workflow state key (e.g. `case_created`, `awaiting_evidence`, `under_review`, `pending_decision`, `escalated`, `closed`, `quarantined`). **Distinct from `status`** — see §1.1. |
| `score`              | smallint (0–100) | no   | Triage priority produced by the agent. Used for sort + colour-banding in the grid. |
| `ai_status`          | text          | no       | AI decision stage: `draft`, `published`, `rejected`, `quarantined`. Keep as plain `text` — **do NOT** create a Postgres enum (see §4). |
| `explanation`        | text          | no       | Framework-quoted rationale. **Mandatory** per README principle #1 (explainability by construction). No row should exist without one. |
| `rejection_reason`   | text          | yes      | Populated when a human reviewer rejects an AI decision. |
| `framework_version`  | text          | no       | The prompt-bank version the score + explanation were produced against. Needed so decisions remain reproducible after framework edits (README §prompt bank). |

### 1.1 `status` vs `state` — don't collapse them

The UI treats these as two separate concepts; the schema should too:

- **`state`** — where the case is in the institution's workflow (owned by `states.json` / prompt bank). Changes as the case progresses.
- **`status`** — operational/legacy flag from the source system (e.g. incoming feed value). Kept for provenance and parity with upstream integrations.

The current `status` column can stay. Add `state` alongside it. The UI's `EnrichedCase.state` reads from `state`; the grid's "State" column renders this value.

---

## 2. `case_required_actions` — new table

The UI surfaces a severity-coded warning indicator next to the state badge when the AI flags that the case is blocked waiting on something (evidence, a review, an escalation). Tooltip + modal both show the structured detail.

UI shape (see `RequiredAction` in `frontend/src/types.ts`):

```ts
{ label: string; items: string[]; severity?: "info" | "warning" | "critical" }
```

Two reasonable implementations — pick one:

### Option A (preferred): dedicated table

```sql
create table case_required_actions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  label text not null,
  items text[] not null default '{}',
  severity text not null default 'warning'
    check (severity in ('info', 'warning', 'critical')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index on case_required_actions (case_id) where resolved_at is null;
```

Pros: easy to audit, easy to render history, fits the "each action is independently resolvable" pattern.

### Option B: JSONB column on `cases`

```sql
alter table cases add column required_action jsonb;
-- shape: { label, items: string[], severity }
```

Pros: simpler query. Cons: no history, can't resolve items independently, harder to audit. **Only use this if we're confident required-actions are always single-shot.**

The UI currently renders at most one active required-action per case, so either option works at render-time. Option A is safer long-term.

---

## 3. `case_timeline` — new table

The UI's case detail modal renders a chronological timeline of events (see `TimelineEvent` in `frontend/src/types.ts`). Currently hand-seeded in fixtures; needs to be real.

```sql
create table case_timeline (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  event_date date not null,
  event text not null,           -- e.g. "evidence_requested", "escalated", "closed"
  note text,
  actor text,                    -- who/what produced the event (user id, "ai_agent", "system")
  created_at timestamptz not null default now()
);
create index on case_timeline (case_id, event_date desc);
```

Every state transition + AI decision + human override should write a row here. This doubles as part of the audit log required for ICO compliance.

---

## 4. Do not use Postgres enums for `ai_status` or `state`

The UI has been updated (this iteration) to type `ai_status` and `state` as plain `string` — not a fixed union — so institutions can extend workflows without a UI release. The schema should match:

- Use `text` + optional `check` constraints (not enum types).
- `check` constraints are cheap to alter (`alter table ... drop constraint ... add constraint ...`). Enum types require `alter type ... add value`, which is not transactional in older PG and is a pain to remove values from.
- States are authoritative in the institution's prompt bank, not in the DB schema. A hard-coded enum would duplicate that source of truth.

Example:

```sql
alter table cases add constraint cases_ai_status_chk
  check (ai_status in ('draft', 'published', 'rejected', 'quarantined'));
```

The `state` column should probably have **no** check constraint at all — states are defined per `case_type` in the prompt bank and vary per institution.

---

## 5. Right-to-erasure — re-anonymise, don't `DELETE`

Per the README, deleting a case under a subject-access / RTE request must **re-anonymise** the record and its vector rather than hard-deleting. Implications:

- Add `anonymised_at timestamptz` to `cases` (nullable).
- A "delete" flow sets this timestamp and overwrites PII-bearing columns (`case_notes`, any free-text, `applicant_id` → null or to a tombstone applicant).
- Vector rows stay — they're already PII-free if the PII filter did its job.
- The UI should hide anonymised rows from the default views but keep them queryable for analytics.

This isn't a UI-blocking change but should land in the same migration batch so we don't ship a schema that invites naive `DELETE`s.

---

## 6. `applicants` table — confirm shape

The UI reads a nested `applicant: { name, reference, date_of_birth }` on each case. The current schema has `applicant_id` as a nullable FK, implying a separate table exists. Please confirm it has at least:

```
id uuid primary key
name text not null
reference text not null           -- the public-facing applicant ref, not the DB pk
date_of_birth date                -- nullable, not always known
```

If the real table diverges, let me know the column names and I'll update the UI mapping layer rather than forcing the backend to rename.

---

## 7. Migration ordering suggestion

1. Additive column migration on `cases` (`state`, `score`, `ai_status`, `explanation`, `rejection_reason`, `framework_version`, `anonymised_at`). All with sensible defaults so existing rows survive.
2. Backfill: set `state = status` for existing rows (one-off, since they were equivalent pre-split).
3. Create `case_required_actions` and `case_timeline`.
4. Add check constraints (after backfill, not before).
5. Only then flip non-null defaults for `explanation` and `framework_version` — rows produced after the triage agent ships will always have them; historic rows will have been backfilled with placeholders + a flag.

---

## 8. Open questions

- **Where does the score live while a case is re-triaged?** If the prompt bank changes and we re-score historic cases, do we version the score rows (like `case_scores` history) or overwrite? I'd argue history — matters for the audit log.
- **Is `assigned_to` a user FK or free text?** Schema has it as `text`. The UI currently renders it as-is. If we have a `users` table, we should FK to it.
- **Timeline `actor` column** — do we want a proper FK to `users` + an `agent` sentinel, or is free text fine for the first cut?

Flag any of the above you want to design together before writing the migration.
