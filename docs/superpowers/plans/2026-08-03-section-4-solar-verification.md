# Section 4 Solar Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Request Google Solar data layers at the `BASE` quality floor, protect the provider request contract with one focused test, and verify the optional Solar visualization end to end.

**Architecture:** Keep the existing Google Solar provider, FastAPI proxy routes, and frontend GeoTIFF/overlay flow unchanged except for the quality parameter. Mock only the provider's external HTTP call in the focused test; use the configured local backend key for live API and browser checks.

**Tech Stack:** Python, FastAPI, httpx, pytest, Ruff, React/Vite, TypeScript, Playwright/browser tooling, GitHub CLI.

## Global Constraints

- Use `requiredQuality=BASE`; BASE is the minimum and still permits higher-quality responses.
- Do not add dependencies, abstractions, caches, or browser behavior.
- Never read credentials into logs or commit `.env` files.
- Preserve unrelated working-tree changes already present in the target checkout.
- Update `/Users/jeonellumbab/Developer/Kahayag-main/Kahayag-old/JEZREEL_CHECKLIST.md` separately from the target Git checkout.
- Use a covered Philippine residential roof coordinate if Cebu has no coverage and record the exact coordinate.

---

### Task 1: Lock the Google Solar data-layer request

**Files:**
- Create: `backend/tests/unit/integrations/solar/test_google_solar.py`
- Modify: `backend/app/integrations/solar/google_solar.py:42-52`

**Interfaces:**
- Consumes: `GoogleSolarProvider.get_data_layers(latitude, longitude, radius_meters)`.
- Produces: one test proving the `dataLayers:get` request contains the requested coordinates, radius, view, API key, and `requiredQuality=BASE`.

- [ ] **Step 1: Write the failing test**

```python
from unittest.mock import patch

from app.integrations.solar.google_solar import DATA_LAYERS_URL, GoogleSolarProvider


def test_get_data_layers_requests_base_quality_and_requested_location():
    response = type(
        "Response",
        (),
        {"status_code": 200, "json": lambda self: {"annualFluxUrl": "annual", "maskUrl": "mask"}},
    )()

    with patch("app.integrations.solar.google_solar.httpx.get", return_value=response) as get:
        result = GoogleSolarProvider(api_key="test-key").get_data_layers(
            latitude=10.3157,
            longitude=123.8854,
            radius_meters=140,
        )

    assert result == {"annualFluxUrl": "annual", "maskUrl": "mask"}
    get.assert_called_once_with(
        DATA_LAYERS_URL,
        params={
            "location.latitude": 10.3157,
            "location.longitude": 123.8854,
            "radiusMeters": 140,
            "view": "IMAGERY_AND_ANNUAL_FLUX_LAYERS",
            "requiredQuality": "BASE",
            "key": "test-key",
        },
        timeout=30.0,
    )
```

- [ ] **Step 2: Run the focused test and verify the expected failure**

Run: `cd backend && .venv/bin/python -m pytest tests/unit/integrations/solar/test_google_solar.py -q`

Expected: FAIL because the current provider sends `requiredQuality=HIGH`.

- [ ] **Step 3: Make the minimal production change**

Change only the `requiredQuality` value in the existing `params` dictionary:

```python
"requiredQuality": "BASE",
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `cd backend && .venv/bin/python -m pytest tests/unit/integrations/solar/test_google_solar.py -q`

Expected: 1 passed.

- [ ] **Step 5: Commit the provider change**

```bash
git add backend/app/integrations/solar/google_solar.py backend/tests/unit/integrations/solar/test_google_solar.py
git commit -m "fix(solar): request base data layer quality"
```

### Task 2: Run automated backend verification

**Files:**
- Read: `backend/pytest.ini`, `backend/requirements-dev.txt`
- Read: `backend/app/main.py`, `backend/app/api/v1/router.py`

**Interfaces:**
- Consumes: the provider test and existing backend routes.
- Produces: fresh full pytest and Ruff results for the target backend.

- [ ] **Step 1: Run the complete backend test suite**

Run: `cd backend && .venv/bin/python -m pytest -q`

Expected: exit 0 with no test failures; report any existing warning exactly.

- [ ] **Step 2: Run Ruff**

Run: `cd backend && .venv/bin/ruff check .`

Expected: exit 0 with no diagnostics.

### Task 3: Verify live Solar, proxies, browser overlay, and fallback

**Files:**
- Modify: `/Users/jeonellumbab/Developer/Kahayag-main/Kahayag-old/JEZREEL_CHECKLIST.md`

**Interfaces:**
- Consumes: configured `backend/.env` values without printing secret values; FastAPI routes under `/api/v1`.
- Produces: recorded HTTP status/payload summaries, imagery quality, raster bounds, overlay alignment, legend values, visible panels, toggle behavior, fallback result, and any alternate coordinate.

- [ ] **Step 1: Start the backend and frontend using existing environment files**

Run the existing project commands from the target checkout, preserving the configured `.env` files and keeping their contents out of output. Use the backend's configured `APP_GOOGLE_SOLAR_API_KEY` and `APP_SOLAR_PROVIDER=google`.

- [ ] **Step 2: Call Building Insights and flux preparation at Cebu**

Use `10.3157,123.8854` against the existing `POST /api/v1/shading/analyze` and `POST /api/v1/solar/flux/prepare` routes. Record only status, non-secret response fields, imagery quality/date, roof segment count, and returned proxy paths.

- [ ] **Step 3: Fetch both GeoTIFF proxies**

Request the returned annual and mask paths. Confirm both return `200`, `image/tiff`, non-empty bytes, and parseable geospatial bounds centered around the request/roof area. Do not log proxy tokens or API keys.

- [ ] **Step 4: Verify the results browser flow**

Open the existing assessment/results flow at the chosen coordinate and inspect the overlay: raster and traced-roof alignment, low-to-high legend labels and numeric range, visible result panels, visible panel placements, on/off toggle state, and successful behavior when optional loading fails.

- [ ] **Step 5: Use and record a covered Philippine coordinate if needed**

If Cebu returns a controlled no-coverage response or the overlay cannot load because coverage is absent, try another Philippine residential roof coordinate already supported by the provider, then record that coordinate and the reason Cebu was skipped.

- [ ] **Step 6: Update the checklist**

Mark only Section 4's final checkbox as `[x]`, append the exact commands and outcomes under Section 4 comments, and include the imagery quality and any fallback coordinate. Do not alter unrelated sections or add credentials.

### Task 4: Publish the verified change

**Files:**
- Read: `git status`, `git diff`, PR #13 metadata.

**Interfaces:**
- Consumes: verified provider/test commit and checklist record.
- Produces: pushed `agent/assessment-backend` branch and updated PR #13.

- [ ] **Step 1: Inspect the final diff and preserve unrelated changes**

Run: `git status --short` and `git diff --check`; stage only the provider/test files and any target-repo verification record that belongs to this task.

- [ ] **Step 2: Push the branch**

Run: `git push -u origin agent/assessment-backend`.

- [ ] **Step 3: Update PR #13**

Add the verified scope and command results to PR #13 using the available GitHub integration/CLI, without exposing credentials or proxy tokens.
