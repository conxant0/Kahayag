# Developer Guide

## Purpose

This guide records the decisions made for Kahayag's project setup. The architecture is intended to make implementation easy to navigate; it is not a permanent rulebook.

Feel free to edit the architecture as the application evolves. Prefer changes that preserve clear responsibilities, readable dependencies, and replaceable external providers.

## Decisions

- The repository is split into `frontend/` and `backend/` first.
- Each application uses a hybrid feature-first structure.
- The frontend uses React, route-based screens, Vite, and Tailwind CSS.
- The frontend is TypeScript throughout, in strict mode. `npm run lint` and `npm run typecheck` both gate it.
- The backend uses FastAPI with framework-independent solar domain modules.
- Assessment data is temporary and no database or account system is included.
- Map, geocoding, solar, AI, and PDF vendors sit behind integration boundaries so they stay replaceable.
- Technical and financial calculations belong in the deterministic backend domain, never in AI report generation.

## Vendor Choices

The default is free and keyless: no paid vendor unless the capability genuinely has no open equivalent.

That default holds everywhere except solar data.

**Google Solar** is accepted as a keyed, billed vendor. Panel-level irradiance and measured per-roof shading do not exist in any free source at the resolution this product needs, and a national average is exactly the thing the product exists to improve on. `buildingInsights:findClosest` supplies roof segments with pitch, azimuth, and annual sunshine hours; `dataLayers:get` supplies the flux and mask rasters behind the shading summary. Coverage is uneven, so the calculation falls back to a nationwide peak-sun-hour assumption and records which source it used.

**Google Maps** follows from that decision rather than standing on its own. Leaflet with Esri World Imagery is free and keyless and was the original choice, but once a Google key exists and the solar rasters are tiled to match Google's imagery, running an open basemap alongside them means reconciling two coordinate and imagery pipelines for no remaining licensing benefit. The map is loaded from a script tag, not an npm dependency.

**Nominatim** handles address search, proxied through the backend. Places autocomplete ships inside the Maps script and is deliberately unused: routing lookups through our own endpoint keeps geocoding a replaceable adapter, enforces the 1 req/sec limit and User-Agent server-side instead of trusting the browser, and avoids introducing a second billed API.

**Groq** writes the report prose, chosen over OpenAI for a free tier with no card on file. **ReportLab** renders the PDF locally, with no external service and no key.

The Maps key ships in the browser bundle and cannot be kept secret. Restrict it by HTTP referrer and enable only the APIs it needs. The Solar and Groq keys stay server-side.

Both keyed integrations default to `disabled`, so the stack boots and the assessment path works with no credentials at all.

## Navigating the Repository

### Frontend

- `frontend/src/app/` composes routes and global providers.
- `frontend/src/features/` contains user-facing capabilities such as property selection, roof tracing, assessment inputs, recommendations, results, and reports.
- `frontend/src/shared/` contains reusable UI, API, configuration, hooks, utilities, and styles.
- `frontend/src/integrations/` isolates map and solar providers and browser storage.
- `frontend/src/state/` holds temporary assessment state shared across routes.
- `frontend/tests/` and `frontend/e2e/` hold frontend verification.

Keep feature-specific files inside their feature. Move code to `shared/` only when multiple features genuinely use it.

### Design System

`frontend/src/shared/components/ui/` holds the shared component library. Screens are composed from these — do not re-implement a pill, chip, or row inline.

Design tokens live in `frontend/src/shared/styles/index.css`:

- Colour, font, and radius tokens sit in `@theme`. The semantic rule is **yellow acts, cobalt informs, ember interrupts**.
- The editorial type/spacing scale sits in `:root` as `--t-*` custom properties with a single `min-width: 1024px` override. The desktop landing frame is the mobile frame at exactly 1.6x, so that relationship is expressed once there rather than as `lg:` overrides on every heading.

Two Tailwind v4 traps worth knowing:

- Bare spacing values resolve as multiples of `--spacing` (0.25rem), so only quarter-steps generate a rule. `gap-4.8` silently produces **nothing**; write `gap-[19.2px]`. Most 1.6x desktop values land here.
- `transition-colors` includes `outline-color`, which makes the focus ring fade in. Interactive components should transition `[background-color,border-color,color]` instead.

### Backend

- `backend/app/api/` composes versioned FastAPI routes.
- `backend/app/core/` contains process-wide configuration, logging, and error translation.
- `backend/app/domain/solar/` contains deterministic geometry, generation, financial, and recommendation rules.
- `backend/app/features/` orchestrates assessment and report use cases.
- `backend/app/integrations/` isolates AI, geocoding, solar, and PDF providers.
- `backend/app/shared/` contains small concepts reused across backend features.
- `backend/tests/` holds domain, feature, API, and contract verification.

Keep the solar domain independent of FastAPI and external providers so its rules remain easy to test and replace.

## Data Flow

### Assessment

```text
Route page
  -> feature hook or form
  -> frontend assessment session store
  -> shared API client
  -> FastAPI feature router
  -> feature service
  -> solar domain rules
  -> response schema
  -> frontend query cache and session store
  -> route UI
```

### Map and Roof Data

```text
Map provider
  -> frontend map adapter
  -> property or roof feature
  -> normalized location and polygon data
  -> assessment session store
  -> backend assessment request
```

Provider-specific map objects should stop at the adapter boundary.

### Reports

```text
Report route
  -> reports feature service
  -> validated assessment values
  -> configured AI adapter or deterministic fallback
  -> report value-preservation validation
  -> PDF adapter
  -> preview or download
```

AI may explain validated values in plain language, but it must not calculate or alter technical and financial results.

## Deployment

`backend/vercel.json` builds `app/main.py` with `@vercel/python`, which
installs from `backend/requirements.txt` and routes every path to that entry
point; the versioned API prefix (`/api/v1/...`) is composed inside the
FastAPI app itself, so the deployed health check is
`https://<backend-project>.vercel.app/api/v1/health`.

The frontend build reads `VITE_API_BASE_URL` from the hosting environment and
fails the build outright if it is missing or lacks a scheme
(`frontend/vite.config.ts`, `frontend/src/shared/config/env.ts`) — the
browser bundle can never fall back to resolving the API against its own
origin. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the post-deploy
smoke checklist and the outstanding frontend handoff.
