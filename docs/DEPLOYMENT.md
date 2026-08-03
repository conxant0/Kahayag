# Deployment

Both applications deploy to Vercel as separate projects, driven by
`.github/workflows/deploy.yml` on pushes to `main`. See [SETUP.md](../SETUP.md#deployment)
for the required repository secrets and the `VITE_API_BASE_URL` Sensitive-flag
caveat.

This document lives in `docs/` (next to the other implementation-facing specs)
rather than in `SETUP.md`, because it is run once per deploy, by whoever holds
deploy access, rather than once per developer machine.

## Post-Deploy Smoke Checklist

Run this after the first deploy of a Vercel project, and after any change to
`backend/vercel.json`, `APP_CORS_ORIGINS`, or `VITE_API_BASE_URL`. It has not
been executed for this branch — no deployment exists yet. Replace
`$API_URL` and `$FRONTEND_URL` with the actual Vercel project URLs, and run
each command from a shell with `curl` and `jq` available.

Record, for each step: the command run, the HTTP status code, the response
timestamp (from the `date` response header or a timestamp field in the body),
and a one-line pass/fail note. Do not record secrets or personal data — the
fixture data below is synthetic.

### 1. Health

```bash
curl -s -o /dev/null -w '%{http_code}\n' "$API_URL/api/v1/health"
curl -s "$API_URL/api/v1/health"
```

Expect: `200`, body `{"status": "ok"}`.

### 2. Property search

```bash
curl -s -o /dev/null -w '%{http_code}\n' "$API_URL/api/v1/properties/search?query=Cebu"
curl -s "$API_URL/api/v1/properties/search?query=Cebu" | jq .
```

Expect: `200`, a JSON array of `{"address", "latitude", "longitude"}` objects.
This calls Nominatim live (no key required); a `502`/`504` here most often
means Nominatim rate-limited the deploy's shared egress IP, not a bug.

### 3. Assessment-shaped report request

Uses `backend/tests/fixtures/completed_assessment.json` as the `assessment`
body, matching `tests/integration/api/test_reports.py`:

```bash
cd backend
python3 -c "
import json
assessment = json.load(open('tests/fixtures/completed_assessment.json'))
roof = [
    {'latitude': '10.31570', 'longitude': '123.88540'},
    {'latitude': '10.31582', 'longitude': '123.88540'},
    {'latitude': '10.31582', 'longitude': '123.88555'},
    {'latitude': '10.31570', 'longitude': '123.88555'},
]
print(json.dumps({
    'assessment': assessment,
    'roof_polygon': roof,
    'panel_polygons': [{'corners': roof}] * 8,
}))
" > /tmp/report-request.json

curl -s -o /tmp/report.pdf -w '%{http_code}\n' \
  -H 'Content-Type: application/json' \
  -d @/tmp/report-request.json \
  "$API_URL/api/v1/reports/pdf"
```

Expect: `200`, `Content-Type: application/pdf`, `Content-Disposition:
attachment; filename="kahayag-solar-report-...pdf"`, and `/tmp/report.pdf`
starts with `%PDF`. With `APP_AI_PROVIDER=disabled` and no Google keys set
(the deployed default), this exercises the deterministic narrative and
static-map fallbacks, not the live Groq/Google Solar providers.

### 4. Frontend API origin

```bash
curl -s "$FRONTEND_URL" | grep -o 'VITE_API_BASE_URL[^"]*' || true
```

The build inlines `VITE_API_BASE_URL` at build time, so it will not appear as
a literal string in the served HTML/JS unless something went wrong; the real
check is behavioral: open `$FRONTEND_URL` in a browser, open devtools network
tab, and confirm every API request goes to `$API_URL/api/v1/...` (i.e.
`VITE_API_BASE_URL` must be set to `$API_URL` with the `/api/v1` suffix
already included, not the bare origin used elsewhere in this checklist),
never to `$FRONTEND_URL` itself. If `VITE_API_BASE_URL` was unset or
scheme-less at build time, the build fails outright (see
`frontend/vite.config.ts` and `frontend/src/shared/config/env.ts`), so a
successful deploy already proves the value was present — this step confirms
it was also the *correct* origin.

### 5. CORS

```bash
curl -s -i -X OPTIONS "$API_URL/api/v1/health" \
  -H "Origin: $FRONTEND_URL" \
  -H "Access-Control-Request-Method: GET" | grep -i 'access-control-allow-origin'
```

Expect the response to echo `$FRONTEND_URL` (or `*`, which this app does not
use) in `Access-Control-Allow-Origin`. If it is missing or wrong, `APP_CORS_ORIGINS`
on the backend Vercel project does not list the frontend's deployed origin.

## Outstanding Handoff

Not built in this branch, and out of scope for it:

- `BriefPage`, `ReportPage`, and `BriefRoofPhoto` frontend components.
- Router wiring for those pages into `frontend/src/app/`.
- `frontend/e2e/` specs exercising the assessment-to-report browser flow.

These depend on another developer's UI kit, assessment session store, and map
components, none of which exist in this repository yet. The API contracts
those components will call are already implemented and tested:
`GET /api/v1/properties/search`, `POST /api/v1/geolocation/approximate`,
`POST /api/v1/solar/flux/prepare`, `GET /api/v1/solar/flux/geotiff/{token}/{layer}`,
and `POST /api/v1/reports/pdf`. The frontend API client
(`frontend/src/shared/api/`), the report-request builder, and the download
hook are already in place for whoever builds those pages next.
