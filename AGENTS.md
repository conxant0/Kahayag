# Agent Instructions

Instructions for AI coding agents working in this repository. Human contributors
should read [CONTRIBUTING.md](CONTRIBUTING.md) and [SETUP.md](SETUP.md), which
these instructions assume.

## What This Project Is

Kahayag Energy is a homeowner-facing solar pre-feasibility application for
residential properties in the Philippines. A homeowner locates their property,
traces their roof, describes their electricity use, and receives a system
recommendation with financial outcomes and a shareable report.

There is no database and no account system. Assessment data lives in browser
session state for the duration of a visit.

## Layout

- `frontend/` — React 19, Vite, Tailwind CSS v4, TypeScript. Feature-first under `src/features/`.
- `backend/` — FastAPI. Feature-first under `app/features/`, with the deterministic solar rules in `app/domain/`.
- `docs/` — product requirements, calculations, stack decisions, ticket priorities.

[DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) has the full directory map and data flow.

## Hard Rules

1. **The domain computes; AI explains.** Every technical and financial number
   comes from `backend/app/domain/`. AI adapters may phrase those values in plain
   language. An agent must never move a calculation into a prompt, and never let
   a model output a number that was not computed deterministically. The report
   path validates value preservation for this reason.
2. **Vendors stay behind adapters.** Google Maps, Google Solar, Nominatim, Groq,
   and ReportLab are reached through `integrations/`. Provider-specific objects
   stop at that boundary. Do not import a vendor SDK into a feature, a domain
   module, or a route component.
3. **The solar domain imports no framework.** No FastAPI, no pydantic-settings,
   no HTTP client inside `backend/app/domain/`.
4. **Frontend source is TypeScript.** Strict mode, no new `.js`/`.jsx` files, no
   `any` added to silence an error.
5. **Secrets never enter the repository.** New configuration goes into the
   matching `.env.example` with a comment, never a real value.

## Working Style

- Read [docs/calculations_guide.md](docs/calculations_guide.md) before touching
  anything that produces a number. The formulas and their assumptions are
  specified there, not invented per feature.
- Keep changes scoped to the ticket. Do not refactor adjacent code opportunistically.
- Prefer the smallest change that works. Do not add abstractions, config options,
  or dependencies for needs that do not exist yet.
- Match the surrounding file's conventions: module-level `# Defines ...` comment
  headers in backend modules, named exports in frontend modules.

## Before Reporting Work Complete

Run the verification that covers what you touched, and report the actual output:

```bash
# backend
cd backend && .venv/bin/python -m pytest && .venv/bin/ruff check .

# frontend
cd frontend && npm run typecheck && npm run lint && npm test
```

If something fails, say so with the failing line. Do not describe unverified work
as done.

## Commits

Conventional Commits, atomic and revertible. See [CONTRIBUTING.md](CONTRIBUTING.md).
Do not commit or push unless asked.
