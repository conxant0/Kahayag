<p align="center">
  <img src="frontend/public/assets/logo.svg" alt="Kahayag Energy logo" width="160" />
</p>
<h1 align="center">Kahayag Energy</h1>

<p align="center">
  <a href="https://kahayag.vercel.app">https://kahayag.vercel.app</a>
</p>

## Project Overview & Objectives

Kahayag Energy is a homeowner-facing solar pre-feasibility application for
residential properties in the Philippines. A homeowner locates their
property, traces their roof, describes their electricity use, and receives a
system recommendation with financial outcomes and a shareable report.

There is no database and no account system — assessment data lives in
browser session state for the duration of a visit. The goal is to give a
homeowner a fast, trustworthy first read on whether solar is worth pursuing,
before they talk to an installer.

- `frontend/` — React application and browser-side assessment flow.
- `backend/` — FastAPI application, deterministic solar domain, and report boundaries.
- `docs/` — product requirements, architecture specifications, and implementation plans.
- `scripts/` — reserved for justified project-level development commands.

See [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) for the full architecture and
data flow, and [docs/calculations_guide.md](docs/calculations_guide.md) for
the authoritative formulas.

## Problem Statement & AI-Based Solution

Homeowners in the Philippines have no easy way to tell whether their specific
roof is a good candidate for solar. Generic calculators use national
averages and ignore roof pitch, azimuth, and shading; a proper site
assessment usually requires booking an installer first.

Kahayag closes that gap by pulling roof-level solar geometry (segment pitch,
azimuth, and annual sunshine hours) for the homeowner's actual address and
running it through a deterministic financial and technical model.

**AI's role is narrow and explicitly bounded:** the domain computes, AI only
explains and customises. Every technical and financial number comes from
`backend/app/domain/`. AI adapters phrase already-validated numbers in plain
language — they never calculate, alter, or invent a figure, brand, guarantee,
or site condition. Three surfaces use AI:

- **Report narration** — an AI adapter turns the validated assessment into a
  shareable PDF with cautious prose; the pipeline verifies value preservation
  before delivery.
- **Design customisation** — a conversational agent lets homeowners refine
  their system (swap panels, add battery, optimise for budget or backup) via
  natural-language chat. The agent calls deterministic solver tools; it does
  not compute prices or yields itself.
- **Quote comparison** — an uploaded installer quote is OCR'd and then an AI
  auditor summarises how the installer's price and specs compare against
  Kahayag's benchmark build, using only extracted facts.

## AI Tools, Frameworks, & Datasets Used

| Category | Choice | Purpose |
| --- | --- | --- |
| LLM (report, design agent, quote audit) | [Groq](https://groq.com/) (OpenAI-compatible chat completions API) | Powers three surfaces: (1) report narration — turns validated report values into cautious prose; (2) design agent — a tool-calling loop that lets homeowners refine their system via natural-language chat (`query_catalog`, `run_solver`, `update_build`, etc.); (3) quote auditor — summarises how an uploaded installer quote compares to Kahayag's benchmark. Chosen over OpenAI for a free tier with no card on file. |
| Quote OCR | [Google Cloud Vision](https://cloud.google.com/vision) (`DOCUMENT_TEXT_DETECTION`), Groq vision fallback, or local Tesseract | Extracts text from uploaded installer quote images/PDFs before the auditor parses facts (total price, system size, panel count). |
| Solar data | [Google Solar API](https://developers.google.com/maps/documentation/solar) (`buildingInsights:findClosest`, `dataLayers:get`) | Supplies per-roof segment pitch, azimuth, annual sunshine hours, and the flux/mask rasters behind the shading summary — the one keyed, billed vendor accepted because no free source has this resolution. |
| Map imagery (browser) | Google Maps JavaScript API | Basemap tiled to match the Google Solar rasters, avoiding a second coordinate/imagery pipeline. |
| Map imagery (PDF) | Google Static Maps API (server key), Esri World Imagery fallback | Satellite basemap behind the roof trace on the downloadable PDF report. Falls back to the keyless Esri tiles when no server key is configured. |
| Address search / geocoding | [Nominatim](https://nominatim.org/) (OpenStreetMap), proxied through the backend | Free, keyless address lookup; server-side proxying enforces the 1 req/sec usage policy and a proper User-Agent. |
| Approximate location | [ip-api.com](http://ip-api.com/), proxied through the backend | Returns a rough lat/lon from the client's IP so the map can centre before the homeowner searches for an address. Keyless, free tier. |
| PDF generation | [ReportLab](https://www.reportlab.com/) | Renders the final report locally, no external service or key. |

**Datasets:** none are bundled or trained on. All solar, imagery, and address
data are fetched live from the vendors above at assessment time; there is no
static dataset in this repository.

All keyed integrations (Google Solar, Groq, Google Cloud Vision) default to
`disabled`. With no credentials configured, the stack still boots: the
assessment falls back to deterministic nationwide peak-sun-hour assumptions,
the design agent uses rule-based responses, the quote auditor is unavailable,
and the report is generated without AI narration — no API key is required to
run or test the project.

## Setup & Run Instructions for Testing the Project

Full details, including deployment, live in [SETUP.md](SETUP.md). Quick
start:

### Prerequisites

- Node.js `>=22.12.0` and npm
- Python `>=3.11`
- Git

### 1. Clone and configure environment

```bash
git clone git@github.com:conxant0/kahayag.git
cd kahayag
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

No API keys are required to boot the stack — all AI and solar providers
default to `disabled` and fall back to deterministic behavior. Environment
notes:

- `frontend/.env` must set `VITE_API_BASE_URL` to an absolute URL including
  the scheme, and `VITE_GOOGLE_MAPS_API_KEY` to a browser key with the Maps
  JavaScript API enabled (restrict by HTTP referrer in Google Cloud Console).
- `backend/.env` optional keys: `APP_GROQ_API_KEY` (report + design agent +
  quote audit), `APP_GOOGLE_SOLAR_API_KEY` (roof-level solar data),
  `APP_GOOGLE_CLOUD_VISION_API_KEY` (quote OCR), `APP_GOOGLE_MAPS_API_KEY`
  (server key for PDF satellite imagery — falls back to keyless Esri tiles).

### 2. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
```

Verify: <http://localhost:8000/api/v1/health> returns `{"status": "ok"}`.
Interactive API docs: <http://localhost:8000/docs>.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Verify: <http://localhost:5173> renders.

### Verification Commands

| Scope | Command | Runs from |
| --- | --- | --- |
| Backend tests | `pytest` | `backend/` |
| Backend lint | `ruff check .` | `backend/` |
| Frontend types | `npm run typecheck` | `frontend/` |
| Frontend lint | `npm run lint` | `frontend/` |
| Frontend unit/integration tests | `npm test` | `frontend/` |
| Frontend end-to-end tests | `npm run test:e2e` | `frontend/` |
| Frontend formatting | `npm run format:check` | `frontend/` |
| Production bundle | `npm run build` | `frontend/` |

Playwright needs its browsers once per machine: `npx playwright install`.

## Further Reading

- [SETUP.md](SETUP.md) — full setup, environment variables, and deployment.
- [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) — architecture decisions, repository navigation, data flow.
- [CONTRIBUTING.md](CONTRIBUTING.md) — branching, commits, review, and verification expectations.
- [docs/calculations_guide.md](docs/calculations_guide.md) — the authoritative formulas, constants, and rounding rules.
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — the post-deploy smoke checklist and outstanding handoff.
