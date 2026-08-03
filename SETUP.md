# Setup

## Prerequisites

- Node.js `>=22.12.0` and npm
- Python `>=3.11`
- Git

## 1. Clone and configure environment

```bash
git clone git@github.com:conxant0/kahayag.git
cd kahayag
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Fill in the values you need. Both applications run with the defaults: the AI and
solar providers start `disabled` and fall back to deterministic behavior, so no
API keys are required to boot the stack.

`frontend/.env` must set `VITE_API_BASE_URL` to an absolute URL including the
scheme. The app throws at startup and the production build fails otherwise —
that guard exists because a scheme-less value silently resolves against the
frontend's own origin.

## 2. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
```

Verify: <http://localhost:8000/api/v1/health> returns `{"status": "ok"}`.
Interactive API docs: <http://localhost:8000/docs>.

## 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Verify: <http://localhost:5173> renders.

## Verification Commands

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

## Deployment

Both applications deploy to Vercel as separate projects, driven by
`.github/workflows/deploy.yml` on pushes to `main`. The workflow needs these
repository secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID_BACKEND`
- `VERCEL_PROJECT_ID_FRONTEND`

Set `VITE_API_BASE_URL` in the frontend Vercel project as a plain (not
Sensitive) environment variable. `vercel pull` cannot decrypt Sensitive values
and hands the build the literal string `[SENSITIVE]`.
