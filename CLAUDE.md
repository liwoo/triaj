# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Status

Only the frontend UI shell has been scaffolded. Backend (ingestion, PII pipeline, LangGraph agent, RabbitMQ workers, Postgres) is still unbuilt — the README is the design doc for those layers.

## Repository Layout

- `data/` — seed fixtures used by the frontend and (eventually) backend: `sample-cases.json`, `states.json` (workflow states + AI status definitions).
- `frontend/` — Next.js 14 App Router + TypeScript + Tailwind UI shell.
  - `app/` — routing only. Route segments import page components from `src/pages/`. The `(app)` route group shares a sidebar layout. Root redirect `/` → `/dashboard`.
  - `src/pages/` — page-level React components (client components). These are imported by the thin `app/**/page.tsx` entry files.
  - `src/components/` — shared components. `Sidebar`, `Layout` (header), `DataTable` (TanStack Table v8 wrapper with search, column filters, sorting, pagination), `CaseDetailModal`, `RejectDialog`, `caseColumns` (reusable column builder).
  - `src/components/ui/` — real **shadcn/ui** components (New York style, slate base, CSS variables). Configured via `components.json`. Installed: button, badge, input, textarea, select, dialog, tooltip, hover-card, dropdown-menu, table, scroll-area, separator, card, label. Customise by editing the files directly — that's the shadcn model.
  - `src/store/cases.tsx` — in-memory `CasesProvider` context holding pending / approved / quarantined cases plus `approve` / `reject` / `reinstate` / `addCase` actions. **Not persisted** — state resets on reload.
  - `src/store/create-dialog.tsx` — tiny `CreateDialogProvider` context that controls the global Create Case modal. The sidebar's "Create" button calls `setOpen(true)`; `<CreateCaseDialog />` is mounted once in `app/(app)/layout.tsx` and listens for that signal. There is intentionally no `/create` route — creation is modal-only.
  - `src/components/theme-provider.tsx` / `src/components/ModeToggle.tsx` — `next-themes` wrapper and the light/dark/system toggle rendered in the sidebar header. `app/layout.tsx` sets `suppressHydrationWarning` on `<html>` to prevent the theme-class mismatch warning on first paint. All colour classes outside the shadcn token set (the `badgeColor()` helper, the CreateCaseDialog success card, and the dashboard "Published" icon) carry explicit `dark:` variants — avoid adding new hard-coded colour classes without dark equivalents.
  - `src/data/cases.ts` — enriches `@data/sample-cases.json` with demo AI fields (`score`, `ai_status`, `state`, `explanation`). Per-case explanations are hand-written to quote framework sections as the README requires. State colours and AI status metadata live here (not in JSON) because the schema in `data/states.json` is the institution's *policy* definition (states, allowed transitions, required actions, escalation thresholds per case type) — UI-only concerns like colour belong in code.
  - `src/lib/utils.ts` — `cn`, `badgeColor`, `formatDate`.

## Frontend Commands

```
cd frontend
npm install                     # first-time only
npm run dev                     # http://localhost:3000
npm run build
npx tsc --noEmit                # full type check
npx shadcn@latest add <name>    # add more shadcn components
```

**Known gotcha**: `npx shadcn@latest add` can fall into an interactive "create a new Next.js project" prompt if it fails to detect the existing project. If that happens, cancel the CLI and write the component file manually from `ui.shadcn.com` — the registry output is plain copy-paste, no build magic.

## Frontend Architecture Notes

- **Next.js `experimental.externalDir: true`** is set in `next.config.mjs` so modules under `frontend/src/` can import the seed JSON from `../data/` via the `@data/*` path alias. Don't remove this flag unless the data files are moved inside `frontend/`.
- **Path aliases**: `@/*` → `frontend/src/*`, `@data/*` → repo-root `data/*`.
- **Client components**: state pages (dashboard, cases/*, create, policies) are client components because they read the in-memory `CasesContext`. Route entry files (`app/**/page.tsx`) are server components that just re-export the client component — keep them thin so the server/client boundary stays clear.
- **Logs menu item** in the sidebar is a static external link placeholder (`cloud.langfuse.com`). When the real LangFuse instance is deployed, swap the URL in `src/components/Sidebar.tsx`.
- **Seed explanations** in `src/data/cases.ts` are demo copy, not real agent output. The `EXPLANATIONS` map should be removed once the triage agent is producing framework-quoted rationales from the prompt bank.
- **Quarantine handling** lives entirely in the context store for now. `reinstate()` moves the case back into `pending` with state `case_created` — mirror this flow if a real backend is wired in.

## Project Vision

Triaj is an open-source, AI-powered complaints triage platform for UK public sector institutions (ICO, local councils, NHS trusts, housing associations, ombudsman offices). It ingests complaints in mixed formats (emails, PDFs, scanned docs, structured forms, call transcripts) and prioritises them against an institution-defined framework with full explainability.

Two non-negotiable design principles drive every architectural decision:

1. **Explainability by construction.** Every prioritisation label must carry a rationale that directly quotes the applicable section of the institution's own framework — not a post-hoc justification. This is required to satisfy the UK Government's AI procurement guidance and the ICO's AI auditing framework.
2. **PII never leaves the premises unanonymised.** PII filtering runs on-prem *before* any persistence or external model call. The high-end triage LLM only ever sees anonymised text. Raw complaint data is encrypted on institution infrastructure; vectors and indices must contain no recoverable personal data.

When designing or reviewing any component, verify it does not violate either principle.

## Intended Architecture (from README)

A complaint flows through these stages; each is a separate concern and should be implemented as an independently testable unit:

1. **Folder upload** — batch of up to 50 case folders (each folder is a complete dossier, not a single document).
2. **Pre-processing & validation** — non-processable cases go to a quarantine state *with a stated reason*, never silently discarded. Quarantined cases are human-reinstateable.
3. **On-prem PII filtering** — layered: Presidio (canonical PII) → GLiNER (quasi-identifiers) → local LLM (Phi-3 / Llama 3.2 for ambiguous cases).
4. **Deduplication** — entity matching (subjects, orgs, reference numbers, thematic similarity); Companies House lookup is a configurable option; ambiguous merges are flagged for human review, never auto-merged.
5. **Indexing & vectorisation** — Postgres + pgvector. Do *not* introduce a separate vector DB; the README's decision to consolidate on Postgres is deliberate (reduces operational surface, single auditable data estate).
6. **Triage agent** — LangChain + LangGraph, stateful multi-step graph: validation → extraction → deduplication → prioritisation → explanation. Each node is independently observable.
7. **Human review interface** — every AI decision must pass through human review before being published. Corrections feed back into framework refinement (this is a learning mechanism, not just a safety valve).

### Key infrastructure choices

- **Job queue: RabbitMQ**, with one job per complaint (not per batch). This is intentional — a single slow/complex case in a batch of 50 must not delay the others, and retries happen per-complaint.
- **Data store: Postgres only** (case records, pgvector embeddings, prompt bank, column mappings, audit log all in one DB).
- **Observability: LangFuse** for agent traces, decision audit log, model quality metrics.
- **Frontend: React**.
- **Containerisation: Docker** — target deployment is on-prem, private cloud, or government-approved secure cloud. No vendor lock-in.

### Right-to-erasure semantics

Deleting a complaint under a subject access / right-to-erasure request **re-anonymises** the vector representation rather than hard-deleting it — this preserves search and analytics integrity while honouring the legal right. Any delete flow must implement this, not a naive `DELETE`.

### Prompt bank

Institution prioritisation logic is captured either via a structured onboarding questionnaire or by extracting logic from an uploaded policy document. The output is a structured prompt stored in an internal "prompt bank" — this prompt governs every triage decision. Framework changes must be **versioned** and attributable, because every prioritisation decision must be reproducible against the framework version in effect at the time.
