# Recommendation and Results Frontend Design

**Date:** 2026-08-03
**Target:** `Kahayag-Final/kahayag/frontend` on `agent/assessment-backend`
**Reference:** `Kahayag-old/frontend`
**Checklist:** Section 3 of `Kahayag-old/JEZREEL_CHECKLIST.md`

## Goal

Port the working recommendation, explanation, results, and layout-editing
experience from `Kahayag-old` into the Section 2 target branch. Preserve the
old information architecture, copy, interactions, and visual hierarchy while
using the target's strict TypeScript setup and V3 shared components.

The completed assessment response remains authoritative. Frontend code formats
and presents backend values; it does not recreate the assessment formulas.

## Source hierarchy and explicit decisions

- `Kahayag-old` supplies the behavioral and visual baseline where it agrees with
  the current target contract.
- `rebuild-jezreel.md` and `JEZREEL_CHECKLIST.md` define the Section 3
  acceptance boundary.
- `docs/calculations_guide.md` governs projection assumptions and current
  calculation semantics.
- The user's explicit decisions override conflicting legacy behavior:
  - implement on top of `agent/assessment-backend`;
  - use close parity with the old frontend;
  - verify with fixtures and no temporary demo route or harness;
  - defer shading and solar-flux integration to Section 4;
  - use 0% electricity-price escalation in the investment projection.

The current PRD describes rising electricity prices, while the current
calculations guide specifies 0% escalation in today's pesos. Section 3 follows
the guide and labels the projection assumption visibly.

## Scope

Included:

- `/results`, `/results/layout`, `/invest`, and `/why` route screens;
- typed result view models and display formatters;
- deterministic panel layout geometry and editing;
- investment projection and prediction-confidence displays;
- panel-count adjustment through the Section 2 endpoint;
- loading, validation-error, missing-result, and no-flux fallback states;
- focused frontend tests using the completed-assessment fixture and a fixed roof
  polygon.

Excluded:

- backend changes or assessment schema changes;
- input-page or session-store schema changes;
- temporary demo routes or fixture injection into production UI;
- shading/flux endpoints, GeoTIFF loading, heatmaps, flux cache/preload, and
  `MapViewToggle`; those remain Section 4;
- new dependencies, report work, or unrelated refactors.

## Architecture and data flow

The Section 2 `useAssessmentStore.result` is the only source of computed
assessment values. The result is held in memory, is not persisted, and is
cleared whenever persisted input context changes.

Result pages narrow the store's opaque response at the feature boundary into a
typed `CompletedAssessment` view contract. The store remains unchanged; the
feature owns the types and formatters so the state schema does not duplicate
the backend model.

Display helpers may round, label, or arrange values, but may not recalculate
backend recommendation, generation, cost, savings, payback, offset, or budget
rules.

The layout editor also reads `selectedProperty`, `roofPolygon`, and
`energyInputs`. These are required to draw the traced roof and submit the
panel-adjustment request; they are context, not alternate sources of computed
truth.

### Panel-count adjustment flow

1. The editor starts from `result.recommendation.panel_count`.
2. A slider change updates local panel-count state and schedules a debounced
   `POST /api/v1/assessments/panel-count-adjustment` request.
3. The successful response is held as a local candidate containing the new
   recommendation and financials. The UI renders those returned values, so all
   figures update through the backend contract rather than browser formulas.
4. The original store result remains unchanged while the candidate is being
   previewed.
5. Save commits the latest successful candidate into the store and navigates to
   `/results`. A `422` or transport error keeps the original result, marks the
   candidate invalid, and exposes a readable error.
6. The panel preview is independently checked with `layoutPanelsInPolygon`.
   The backend remains the authority for roof, demand, and budget feasibility.

## Page behavior

### `/results`

Preserve the old verdict layout and panel-first presentation. Display the
backend values required by the PRD and rebuild plan:

- preliminary status;
- panel category, count, and system capacity;
- annual generation and demand offset;
- estimated cost range;
- monthly and annual savings;
- payback;
- budget and budget compatibility when supplied;
- rationale and limiting constraint;
- assumptions, cost inclusions, potential exclusions, and limitations;
- optional shading impact text when `result.shading` exists.

No flux request is made. The map stays usable in panel-only/no-flux mode.

### `/results/layout`

Preserve the old layout editor's slider, reset/recommended controls, live panel
placement, and save interaction. The live values shown during editing come from
the latest successful adjustment response, not from `liveEstimate.js` or copied
financial formulas. Invalid counts cannot be presented as accepted layouts.

Without a result, the route redirects to `/energy`. A pending adjustment
disables save; a failed adjustment leaves the stored result untouched.

### `/invest`

Preserve the old investment screen's long-term summary, milestone timeline,
growth bars, break-even copy, CO2 estimate, and local assumption sliders.
Sliders change only the projection view and never mutate the assessment result.

The projection starts from the stored backend financials and uses:

- 25-year analysis period;
- 0% electricity-price escalation;
- 0.5% annual panel degradation;
- clear projection/non-guarantee labeling.

There is no demo projection when `result` is missing; the route redirects to
`/energy`.

### `/why`

Preserve the old confidence breakdown and explanation layout. Confidence is
derived from roof context, solar-resource assumptions, optional shading data,
and local-grid/input provenance. Missing shading is described as a planning
limitation; the page does not claim satellite-map analysis without that data.

There is no demo confidence state when `result` is missing; the route redirects
to `/energy`.

## Files and boundaries

Create or modify only:

- `frontend/src/features/recommendation/` for the investment and confidence
  screens, projection, confidence helpers, and feature-local view models;
- `frontend/src/features/results/` for result formatting/types, pages, layout
  context, deterministic panel geometry, panel-only map components, and the
  typed adjustment hook;
- `frontend/src/app/router.tsx` to replace the four pending route elements;
- `frontend/src/shared/api/endpoints.ts` to add the existing Section 2 panel
  adjustment endpoint reference.

Do not modify `frontend/src/shared/api/client.ts` or
`frontend/src/state/assessmentStore.ts` unless an agreed contract defect is
found.

The old `liveEstimate.js` is not ported. The old flux, heatmap, GeoTIFF,
`MapViewToggle`, and preload files are not ported until Section 4.

## Testing and verification

Focused tests must cover:

- fixture-backed result formatting and required result fields;
- missing-result recovery for the four routes;
- panel count, polygon containment, panel dimensions, and invalid geometry;
- adjustment candidate success, `422`/transport failure, and store immutability
  before save;
- investment projection rows, break-even, 0% escalation, and 0.5% degradation;
- confidence bands and wording for fallback versus location-specific data.

Use `backend/tests/fixtures/completed_assessment.json` and a fixed polygon;
do not introduce a second production contract or a temporary demo path.

Verification from `frontend/`:

```bash
npm run typecheck
npm run lint
npm test -- --run tests/unit/features/recommendation tests/unit/features/results
```

The full browser assessment journey remains outside this slice because the
upstream input screens are not yet implemented on the target branch.

## Acceptance criteria

- The four routes render from the stored completed assessment and safely
  recover when it is absent.
- Results expose the PRD-required recommendation, financial, assumption, and
  limitation fields without duplicating backend formulas.
- Panel-count changes use the Section 2 adjustment endpoint; candidate values
  update from its response, and the original result changes only after save.
- Panel geometry is deterministic and never presents an out-of-polygon layout
  as valid.
- The investment projection is visibly labelled, uses 0% escalation and 0.5%
  degradation, and does not claim to be a forecast.
- Confidence text accurately distinguishes planning fallback from optional
  location-specific/shading data.
- Flux and shading visualization remain deferred and cannot block core results.
- Focused typecheck, lint, and frontend tests pass.
