# Agent Instructions

Instructions for AI coding agents working in this repository. Human contributors
should read [CONTRIBUTING.md](CONTRIBUTING.md) and [SETUP.md](SETUP.md), which
these instructions assume. Use
[docs/TECHNICAL_OVERVIEW.md](docs/TECHNICAL_OVERVIEW.md) for the current product,
routes, APIs, state model, and architecture.

## What This Project Is

Kahayag Energy is a homeowner-facing solar pre-feasibility application for
residential properties in the Philippines. A homeowner traces a roof and enters
their electricity use, then receives deterministic system and financial results.
The journey continues through equipment design, installer-quote comparison,
quotation, permit readiness, and a shareable report.

There is no database or account system. Property, roof, energy, plan, and contact
inputs use browser `sessionStorage`; the assessment result, design session, quote
audits, and solar-flux cache are memory-only. Do not introduce persistence or
authentication without an explicit product decision.

## Layout

- `frontend/` — React 19, Vite, Tailwind CSS v4, strict TypeScript.
  - `src/app/` composes routes.
  - `src/features/` owns user-facing capabilities.
  - `src/shared/` holds genuinely reused UI, API, config, hooks, and utilities.
  - `src/integrations/` isolates browser-side providers and storage.
  - `src/state/` holds temporary cross-route state.
- `backend/` — FastAPI.
  - `app/api/` composes versioned routes; `app/features/` orchestrates use cases.
  - `app/domain/` contains deterministic solar, design, shading, and permit rules.
  - `app/integrations/` isolates external providers; `app/data/` holds catalogs.
  - `app/core/` and `app/shared/` contain process-wide and reused concepts.
- `docs/` — product, calculation, architecture, and deployment references.
- `scripts/` — justified project-level development commands only.

## Hard Rules

1. **The domain computes; AI explains or extracts.** Technical and financial
   results, design choices, comparisons, and permit conclusions come from
   `backend/app/domain/`. AI may narrate validated values, extract facts from an
   uploaded document, or choose deterministic tools. It must not calculate,
   alter, or invent a result. Extracted facts retain their source; deterministic
   code derives every comparison and conclusion from them.
2. **Client calculations have one narrow exception.** A responsive form preview
   may mirror published domain arithmetic only in
   `frontend/src/features/assessment/liveEstimate.ts`. It must be labelled as an
   estimate, never persisted or submitted as a result, and every kept figure must
   still come from `POST /assessments`. A second preview requires owner approval.
3. **External providers stay behind adapters.** All maps, solar, geocoding,
   geolocation, AI, OCR, PDF, imagery, and government-service access belongs in
   `integrations/`. Provider-specific objects stop there. Do not import a vendor
   SDK into a feature, domain module, or route component.
4. **The domain imports no framework or provider.** Nothing in
   `backend/app/domain/` may import FastAPI, pydantic-settings, HTTP clients,
   feature modules, or integration modules.
5. **Frontend source is TypeScript.** Strict mode, no new `.js`/`.jsx` source
   files, and no `any` added to silence an error.
6. **Secrets never enter the repository.** Put new configuration, with a comment
   and placeholder only, in the matching `.env.example`.

## Working Style

- Read [docs/calculations_guide.md](docs/calculations_guide.md) before changing
  anything that produces a solar or financial number. Do not invent formulas,
  assumptions, or rounding rules per feature.
- Trace the real flow before editing. Fix shared root causes once and keep changes
  scoped to the ticket; do not refactor adjacent code opportunistically.
- Prefer the smallest change that works. Reuse existing UI, helpers, types, and
  installed dependencies before adding code or packages.
- Keep feature code inside its feature. Promote it to `shared/` only after a
  second real consumer exists.
- Preserve accessibility, validation at trust boundaries, and error handling that
  prevents incorrect results or data loss.
- Match surrounding conventions: module-level `# Defines ...` comments in backend
  modules and named exports in frontend modules.
- Non-trivial logic ships with the smallest test that would fail if it regressed.
  Tests live in `backend/tests/` or `frontend/tests/`.

## Before Reporting Work Complete

Run the checks covering what you touched and report their actual output:

```bash
# backend
cd backend && .venv/bin/python -m pytest && .venv/bin/ruff check .

# frontend core
cd frontend && npm run typecheck && npm run lint && npm test && npm run format:check
```

Also run `npm run test:e2e` for routed browser flows and `npm run build` for
build, environment, or deployment changes. If a check fails, report the failing
line. Do not describe unverified work as done.

## Commits

Use atomic, revertible Conventional Commits; see
[CONTRIBUTING.md](CONTRIBUTING.md). Do not commit or push unless asked.
