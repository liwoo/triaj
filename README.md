# Triaj

Triaj is an open-source, AI-powered complaints triage platform for UK public sector institutions. It ingests complaint folders (emails, PDFs, scanned documents, transcripts, structured forms), anonymises personal data on-premises, and prioritises each case against the institution's own framework — producing a score, a label, and a framework-quoted explanation that a human reviewer approves or corrects before anything is published.

## Quick start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ (LTS recommended)
- [npm](https://www.npmjs.com/) 9+ (ships with Node)
- A [Supabase](https://supabase.com/) project (free tier works) — or run without it using the built-in fixture data

### 1. Clone the repo

```bash
git clone https://github.com/AkumuJey/triaj.git
cd triaj
```

### 2. Install dependencies

```bash
cd frontend
npm install
```

### 3. Configure environment variables

Copy the example file and fill in your Supabase credentials. If you skip this step the app still runs — it falls back to local demo data.

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

You can find both values in the Supabase dashboard under **Settings > API**.

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You should see the GOV.UK-styled dashboard with sample case data.

### 5. Build for production

```bash
npm run build
npm start
```

## Project structure

```
triaj/
  data/                 # Seed fixtures (sample cases, workflow states)
  frontend/             # Next.js 14 app (App Router, TypeScript, Tailwind)
    app/                # Route segments — thin wrappers that import screens
    src/
      components/       # Shared UI (DataTable, dialogs, GOV.UK chrome)
      components/gov/   # GOV.UK Design System components (header, footer, tags)
      components/ui/    # shadcn/ui primitives restyled for GOV.UK
      screens/          # Page-level client components
      data/             # Enrichment logic and demo data helpers
      lib/              # Supabase client, API helpers, SEO config, utilities
      store/            # React context providers (cases, create dialog)
      types.ts          # Shared TypeScript types
```

## Supabase setup

If you want to connect to a real backend:

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Create the following tables: `cases`, `applicants`, `case_timeline`, `case_required_actions`
3. Create two storage buckets: `uploads-quarantine` (for incoming complaint folders) and `policy-documents` (for institution policy PDFs)
4. Copy your project URL and anon key into `.env.local`

Without Supabase configured, the app runs entirely on the fixture data in `data/sample-cases.json` — all features work, actions just aren't persisted.

## Running without Supabase

No configuration needed. Just run:

```bash
cd frontend
npm install
npm run dev
```

The app detects that Supabase is not configured and uses built-in demo data. You can create cases, approve, reject, and filter — everything works in-memory and resets on page reload.

## Available scripts

From `frontend/`:

| Command | What it does |
|---|---|
| `npm run dev` | Start the Next.js dev server on port 3000 |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | Run Next.js linting |
| `npx tsc --noEmit` | Full TypeScript type check |

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS |
| UI components | shadcn/ui (restyled to GOV.UK Design System) |
| Data grid | TanStack Table v8 |
| Database | Supabase (Postgres) |
| Storage | Supabase Storage (complaint folders, policy documents) |
| Icons | Lucide React |
| Theme | next-themes (light/dark/system) |

## Motivation

See [MOTIVATION.md](./MOTIVATION.md) for the full background on why this project exists, the problem it solves, the architecture decisions, and the AI governance model.

## Licence

MIT
