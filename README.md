<p align="center">
  <img src="frontend/public/assets/logo.svg" alt="Kahayag Energy logo" width="160" />
</p>
<h1 align="center">Kahayag Energy</h1>

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
explains. Every technical and financial number in a report comes from
`backend/app/domain/`. An AI adapter may phrase those already-validated
numbers in plain, cautious language for the final report — it never
calculates, alters, or invents a number, brand, guarantee, or site condition.
The report pipeline validates that AI output preserves the underlying values
before it reaches the user.

## AI Tools, Frameworks, & Datasets Used

| Category | Choice | Purpose |
| --- | --- | --- |
| Report narration | [Groq](https://groq.com/) (OpenAI-compatible chat completions API) | Turns validated report values into cautious, plain-language prose (executive summary, technical/financial explanation, contractor observations). Chosen over OpenAI for a free tier with no card on file. |
| Solar data | [Google Solar API](https://developers.google.com/maps/documentation/solar) (`buildingInsights:findClosest`, `dataLayers:get`) | Supplies per-roof segment pitch, azimuth, annual sunshine hours, and the flux/mask rasters behind the shading summary — the one keyed, billed vendor accepted because no free source has this resolution. |
| Map imagery | Google Maps (browser script tag) | Basemap tiled to match the Google Solar rasters, avoiding a second coordinate/imagery pipeline. |
| Address search / geocoding | [Nominatim](https://nominatim.org/) (OpenStreetMap), proxied through the backend | Free, keyless address lookup; server-side proxying enforces the 1 req/sec usage policy and a proper User-Agent. |
| PDF generation | [ReportLab](https://www.reportlab.com/) | Renders the final report locally, no external service or key. |

**Datasets:** none are bundled or trained on. All solar, imagery, and address
data are fetched live from the vendors above at assessment time; there is no
static dataset in this repository.

Both keyed integrations (Google Solar, Groq) default to `disabled`. With no
credentials configured, the stack still boots and the assessment path falls
back to deterministic nationwide peak-sun-hour assumptions and a
non-AI-generated report — no API key is required to run or test the project.

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

No API keys are required to boot the stack — the AI and solar providers
default to `disabled` and fall back to deterministic behavior. `frontend/.env`
must set `VITE_API_BASE_URL` to an absolute URL including the scheme.

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
