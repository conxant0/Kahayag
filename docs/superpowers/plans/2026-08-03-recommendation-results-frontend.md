# Recommendation and Results Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port Kahayag-old's recommendation, explanation, results, and layout-editing experience into the strict TypeScript frontend on top of `agent/assessment-backend`.

**Architecture:** Keep `useAssessmentStore.result` as the only source of computed assessment truth. Reuse the existing shared `AssessmentResult` contract and assessment formatters, port the old page hierarchy and deterministic panel layout, and use the Section 2 panel-adjustment endpoint for candidate values. Keep flux, heatmaps, and GeoTIFF work out of this slice.

**Tech Stack:** React 19, React Router 7, TypeScript strict mode, Zustand, TanStack Query, Vitest, Testing Library, native SVG, Tailwind CSS v4, and the existing shared V3 components.

## Global Constraints

- Build on the `agent/assessment-backend` branch at `/private/tmp/kahayag-assessment-backend`; preserve the existing Section 2 index/worktree changes.
- Use `Kahayag-old/frontend` as the behavioral and visual reference where it agrees with the current target contract.
- Treat the completed assessment response as the authoritative result consumed by the frontend.
- Keep deterministic technical and financial calculations in the backend; frontend helpers format or project display values only.
- Do not modify `frontend/src/state/assessmentStore.ts` or the backend assessment schemas.
- Use 0% electricity-price escalation and 0.5% annual panel degradation in the investment projection; expose both assumptions in the UI.
- Do not add dependencies, temporary demo routes, fixture injection into production UI, or unrelated refactors.
- Defer shading/flux endpoints, GeoTIFF loading, heatmaps, flux cache/preload, and `MapViewToggle` to Section 4.
- Use the existing completed-assessment fixture and fixed polygon for tests; do not create a second production contract.
- Preserve accessible keyboard controls, focus states, readable errors, and mobile/desktop layouts.

---

### Task 1: Complete the typed result formatters and API endpoint reference

**Files:**

- Consume: `frontend/src/shared/api/types.ts`
- Modify: `frontend/src/features/assessment/formatAssessmentResult.ts`
- Create: `frontend/tests/fixtures/assessmentFixture.ts`
- Create: `frontend/tests/unit/features/assessment/formatAssessmentResult.test.ts`
- Modify: `frontend/src/shared/api/endpoints.ts`

**Interfaces:**

- Reuse the existing `AssessmentResult` contract from `shared/api/types.ts`; do not create a second result schema.
- `readAssessmentResult(raw: unknown): AssessmentResult | null` narrows the opaque store value at the results-feature boundary.
- Extend the existing assessment formatter module with cost range, offset, budget, and assumption display helpers while retaining its current exports.
- `formatPeso(value: number | string | null | undefined): string` reuses the existing shared `peso` behavior with `en-PH` grouping.
- `formatSystemCapacity`, `formatAnnualGeneration`, and `formatPaybackYears` keep their existing display contracts.
- `formatOffset(result: AssessmentResult | null): string` returns a percentage from `annual_consumption_offset_ratio`.
- `formatCostRange(result: AssessmentResult | null): string` returns the low-high peso range.
- `buildResultsStats(result: AssessmentResult | null): ResultsStat[]` remains the summary-row source.
- `ENDPOINTS.panelCountAdjustment` is `"/assessments/panel-count-adjustment"`.

The test fixture module should stay test-only and be this small:

```tsx
import rawFixture from "../../../backend/tests/fixtures/completed_assessment.json";
import type { AssessmentResult } from "../../src/shared/api/types";

export const assessmentFixture = rawFixture as AssessmentResult;
```

- [ ] **Step 1: Write failing formatter and fixture tests.**

```tsx
import { describe, expect, it } from "vitest";

import {
  formatCostRange,
  formatOffset,
  formatPaybackYears,
  formatPeso,
  readAssessmentResult,
} from "../../../../src/features/assessment/formatAssessmentResult";
import { assessmentFixture as fixture } from "../../../fixtures/assessmentFixture";
import type { AssessmentResult } from "../../../../src/shared/api/types";

describe("assessment result formatting", () => {
  it("narrows and formats the representative completed assessment", () => {
    const result = readAssessmentResult(fixture);

    expect(result).not.toBeNull();
    expect(formatPeso(result?.financials.annual_savings_php)).toBe("₱22,704");
    expect(formatCostRange(result!)).toBe("₱180,000–₱252,000");
    expect(formatOffset(result!)).toBe("32%");
    expect(formatPaybackYears(result!)).toBe("9.5 years");
  });

  it("returns null for an absent or non-object result", () => {
    expect(readAssessmentResult(null)).toBeNull();
    expect(readAssessmentResult({} as AssessmentResult)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the new formatter test and verify the missing-export failure.**

Run from `frontend/`:

```bash
npm test -- --run tests/unit/features/assessment/formatAssessmentResult.test.ts
```

Expected: FAIL because the existing formatter module does not yet export the new cost, offset, peso, or narrowing helpers.

- [ ] **Step 3: Add the local fixture and complete the shared-contract display helpers.**

Create `frontend/tests/fixtures/assessmentFixture.ts` by importing `../../../backend/tests/fixtures/completed_assessment.json` and exporting it as `AssessmentResult` after the existing JSON contract has been checked. Use the exact backend field names from `backend/app/features/assessment/schemas.py`. Keep decimal-valued JSON fields as `number | string` at the input boundary and convert only inside display helpers. Do not add formulas for generation, savings, offset, payback, or budget.

Implement `readAssessmentResult` as a narrow boundary check for the required top-level object sections (`property`, `roof`, `inputs`, `recommendation`, `financials`, `assumptions`, `limitations`, and `is_provisional`) and return the existing `AssessmentResult` type. Do not modify the Zustand store type.

Add `panelCountAdjustment` to `ENDPOINTS` without changing `apiPost`.

- [ ] **Step 4: Run the formatter tests and verify they pass.**

```bash
npm test -- --run tests/unit/features/assessment/formatAssessmentResult.test.ts
```

Expected: all formatter and narrowing tests pass.

- [ ] **Step 5: Commit the result formatters and fixture.**

```bash
git add frontend/src/features/assessment/formatAssessmentResult.ts frontend/src/shared/api/endpoints.ts frontend/tests/fixtures/assessmentFixture.ts frontend/tests/unit/features/assessment/formatAssessmentResult.test.ts
git commit -m "feat: complete assessment result formatters"
```

---

### Task 2: Port the investment projection and confidence helpers

**Files:**

- Create: `frontend/src/features/recommendation/investmentProjection.ts`
- Modify: `frontend/src/features/recommendation/predictionConfidence.ts`
- Create: `frontend/src/features/recommendation/index.ts`
- Create: `frontend/tests/unit/features/recommendation/investmentProjection.test.ts`
- Create: `frontend/tests/unit/features/recommendation/predictionConfidence.test.ts`
- Consume: `frontend/src/shared/api/types.ts`
- Consume: `frontend/src/features/assessment/formatAssessmentResult.ts`

**Interfaces:**

- `buildInvestmentDefaults(result: AssessmentResult): InvestmentDefaults` uses `financials.estimated_base_cost_php`, `financials.annual_savings_php`, `recommendation.annual_generation_kwh`, and the stored input rate/consumption as the baseline.
- `computeInvestmentProjection(inputs: InvestmentProjectionInputs): InvestmentProjection` returns `annualSavingsPhp`, `monthlySavingsPhp`, `breakEvenYear`, `year10Net`, `year25Net`, `lifetimeGrossSavings`, and four `growthBars`.
- `buildInvestmentSliderBounds(defaults: InvestmentDefaults): InvestmentSliderBounds` preserves the old 0.5x–1.5x cost/usage slider ranges and fixed rate bounds.
- `clampInvestmentInputs(defaults: InvestmentDefaults, bounds: InvestmentSliderBounds): InvestmentInputs` clamps initial local slider values without mutating the store.
- `formatBreakEvenYear`, `formatCompactPeso`, `formatInsightText`, `formatPeso`, and `formatTimelinePeso` remain pure display functions.
- `buildPredictionConfidence(args: { result: AssessmentResult; roofPolygon: AssessmentStoreRoofPolygon | null; energyInputs: EnergyInputs }): PredictionConfidence` returns the overall percentage, factor rows, introduction, and advanced-analysis copy.

Use a local alias for the assessment-store roof polygon when calling confidence/layout helpers; the shared API `RoofPolygon` intentionally has a different, response-independent shape.

- [ ] **Step 1: Write failing projection and confidence tests using the fixture.**

```tsx
import { describe, expect, it } from "vitest";

import {
  buildInvestmentDefaults,
  computeInvestmentProjection,
} from "../../../../src/features/recommendation/investmentProjection";
import { assessmentFixture as fixture } from "../../../fixtures/assessmentFixture";

describe("investment projection", () => {
  it("starts from backend financials and keeps today's-peso assumptions", () => {
    const defaults = buildInvestmentDefaults(fixture);
    const projection = computeInvestmentProjection(defaults);

    expect(defaults.systemCostPhp).toBe(216000);
    expect(defaults.annualSavingsPhp).toBe(22704);
    expect(projection.assumptions.electricityEscalationRatio).toBe(0);
    expect(projection.assumptions.annualPanelDegradationRatio).toBe(0.005);
    expect(projection.growthBars).toHaveLength(4);
  });
});
```

```tsx
import { assessmentFixture as fixture } from "../../../fixtures/assessmentFixture";
import { describe, expect, it } from "vitest";

import { buildPredictionConfidence } from "../../../../src/features/recommendation/predictionConfidence";

describe("prediction confidence", () => {
  it("reports a planning-level fallback when shading is absent", () => {
    const summary = buildPredictionConfidence({
      result: { ...fixture, shading: null },
      roofPolygon: null,
      energyInputs: { electricityRatePhpPerKwh: 12 },
    });

    expect(summary.factors.some((factor) => factor.confidence === "N/A")).toBe(true);
    expect(summary.advancedAnalysis).not.toContain("satellite shading map");
  });
});
```

- [ ] **Step 2: Run the new tests and verify the projection-module failure.**

```bash
npm test -- --run tests/unit/features/recommendation/investmentProjection.test.ts tests/unit/features/recommendation/predictionConfidence.test.ts
```

Expected: FAIL because `investmentProjection.ts` does not yet exist; the existing confidence helper may also fail its no-demo expectation.

- [ ] **Step 3: Port the old helper behavior into TypeScript with the approved corrections.**

Port the old projection structure, milestone rows, growth bars, local sliders, and confidence bands. Make these changes while porting:

- remove demo defaults; callers must provide a completed result;
- use the fixture/backend `annual_savings_php` as the baseline year-one savings value;
- use 0% electricity escalation and 0.5% panel degradation;
- label the output as a projection, not a forecast;
- make missing shading copy say planning/fallback rather than claiming a satellite map;
- keep slider changes local to the investment page.

For the 25-year rows, use `yearNGeneration = year1Generation * (1 - 0.005) ** (n - 1)` and the same degradation factor for savings; do not apply a rate-escalation multiplier. Start cumulative net at `-systemCostPhp`, and use the first non-negative cumulative value for break-even. Keep all constants in these feature modules. Do not add a general configuration layer. Remove the existing demo branch from `predictionConfidence.ts`; its only supported input is a completed result.

- [ ] **Step 4: Run the helper tests and verify they pass.**

```bash
npm test -- --run tests/unit/features/recommendation/investmentProjection.test.ts tests/unit/features/recommendation/predictionConfidence.test.ts
```

Expected: all projection and confidence tests pass, including the 0% escalation assertion.

- [ ] **Step 5: Commit the recommendation helpers.**

```bash
git add frontend/src/features/recommendation frontend/tests/unit/features/recommendation
git commit -m "feat: add recommendation projection helpers"
```

---

### Task 3: Port deterministic panel layout geometry and context

**Files:**

- Modify: `frontend/src/features/results/panelLayoutUtils.ts`
- Create: `frontend/src/features/results/layoutContext.ts`
- Create: `frontend/tests/unit/features/results/panelLayoutUtils.test.ts`
- Consume: `frontend/src/shared/api/types.ts`
- Consume: `frontend/src/state/assessmentStore.ts`

**Interfaces:**

- `layoutPanelsInPolygon(args: { coordinates: GeoPoint[]; panelCount: number; panelWidthM: number; panelHeightM: number; gapM?: number }): LayoutPanel[]` returns only panel footprints whose corners fit inside the traced polygon.
- `primaryRoofAngleRadians(coordinates: GeoPoint[]): number` returns the deterministic orientation used by the packing routine.
- `resolveLayoutContext(args: { result: AssessmentResult; roofPolygon: AssessmentStoreRoofPolygon | null }): LayoutContext` returns panel dimensions, current/recommended count, maximum geometrically placeable count, and roof coordinates.
- `LayoutContext.maxPanels` is a UI geometry ceiling only; the backend remains authoritative for budget and demand limits.
- No `flux` argument, GeoTIFF import, sampling, or heatmap dependency is allowed in this task.

Define `AssessmentStoreRoofPolygon` as the imported `RoofPolygon` type from `state/assessmentStore.ts`; do not change either existing contract.

- [ ] **Step 1: Port the old geometry tests to strict TypeScript and remove flux-specific cases.**

Use `GeoPoint` coordinates and the existing `LayoutPanel` shape. Keep tests for:

- positive placement count inside the Cebu rectangle;
- centered placement;
- L-shaped polygon containment;
- rotated roof orientation;
- panel dimensions and gap behavior;
- zero/negative count returning no placements.

Add a direct containment assertion for every returned corner against the fixed polygon bounds and a test that a requested count larger than the feasible geometry never returns more panels than fit.

- [ ] **Step 2: Run the layout tests and verify the missing-context failure.**

```bash
npm test -- --run tests/unit/features/results/panelLayoutUtils.test.ts
```

Expected: FAIL because `layoutContext.ts` and the required geometry exports/tests do not yet exist or do not meet the new contract.

- [ ] **Step 3: Complete the equirectangular projection and simplified packing algorithm.**

Preserve the existing/old deterministic orientation, rotation, centering, polygon containment, panel dimensions, and gap behavior. Remove flux scoring entirely for Section 3. Keep the current no-flux comment and make the public geometry types use the shared `GeoPoint` contract.

Resolve the slider ceiling with a bounded geometry scan derived from the traced roof area and panel footprint. Add this comment at the scan so the deliberate ceiling is visible:

```ts
// ponytail: bounded geometry scan is enough for residential roofs; use a
// packing solver only if real layouts exceed this small physical search space.
```

Do not use the old `liveEstimate.js` to calculate demand, savings, budget, or recommendation limits.

- [ ] **Step 4: Implement `resolveLayoutContext`.**

Read panel dimensions and the recommended/current count from `result`. Use the assessment-store roof polygon only for traced coordinates and geometry preview. Keep `maxPanels` as the geometry ceiling; invalid budget/demand choices are rejected by the adjustment endpoint and shown as errors. Alias the store's opaque `RoofPolygon` type locally instead of changing the shared API contract.

- [ ] **Step 5: Run the layout tests and verify they pass.**

```bash
npm test -- --run tests/unit/features/results/panelLayoutUtils.test.ts
```

Expected: all deterministic placement, containment, dimension, and invalid-input tests pass.

- [ ] **Step 6: Commit the layout utilities.**

```bash
git add frontend/src/features/results/panelLayoutUtils.ts frontend/src/features/results/layoutContext.ts frontend/tests/unit/features/results/panelLayoutUtils.test.ts
git commit -m "feat: add deterministic panel layout geometry"
```

---

### Task 4: Add the typed panel-adjustment request and candidate flow

**Files:**

- Create: `frontend/src/features/results/panelCountAdjustment.ts`
- Create: `frontend/src/features/results/hooks/useAdjustPanelCount.ts`
- Create: `frontend/tests/unit/features/results/panelCountAdjustment.test.ts`
- Consume: `frontend/src/shared/api/endpoints.ts`
- Consume: `frontend/src/shared/api/client.ts`
- Consume: `frontend/src/shared/api/types.ts`

**Interfaces:**

- `PanelCountAdjustmentRequest` mirrors the backend request: `{ property, roof, inputs, requested_panel_count }`.
- `PanelCountAdjustmentResponse` contains only `{ recommendation, financials }`.
- `buildPanelCountAdjustmentPayload(result: AssessmentResult, requestedPanelCount: number): PanelCountAdjustmentRequest` uses `result.property`, `result.roof`, and `result.inputs`; it does not reconstruct these values from session inputs.
- `useAdjustPanelCount()` exposes a TanStack Query mutation whose `mutationFn` calls `apiPost<PanelCountAdjustmentResponse>(ENDPOINTS.panelCountAdjustment, payload)`.
- `mergePanelAdjustment(result: AssessmentResult, adjustment: PanelCountAdjustmentResponse): AssessmentResult` returns a new result with only `recommendation` and `financials` replaced.

- [ ] **Step 1: Write failing payload and merge tests.**

```tsx
import { describe, expect, it } from "vitest";

import {
  buildPanelCountAdjustmentPayload,
  mergePanelAdjustment,
} from "../../../../src/features/results/panelCountAdjustment";
import { assessmentFixture as fixture } from "../../../fixtures/assessmentFixture";

describe("panel count adjustment", () => {
  it("builds the request from the authoritative result context", () => {
    const payload = buildPanelCountAdjustmentPayload(fixture, 10);

    expect(payload.property).toEqual(fixture.property);
    expect(payload.roof).toEqual(fixture.roof);
    expect(payload.inputs).toEqual(fixture.inputs);
    expect(payload.requested_panel_count).toBe(10);
  });

  it("does not mutate the original result when merging a candidate", () => {
    const adjustment = {
      recommendation: { ...fixture.recommendation, panel_count: 10 },
      financials: { ...fixture.financials, estimated_base_cost_php: 270000 },
    };
    const next = mergePanelAdjustment(fixture, adjustment);

    expect(fixture.recommendation.panel_count).toBe(8);
    expect(next.recommendation.panel_count).toBe(10);
    expect(next.assumptions).toEqual(fixture.assumptions);
  });
});
```

- [ ] **Step 2: Run the request tests and verify the missing-module failure.**

```bash
npm test -- --run tests/unit/features/results/panelCountAdjustment.test.ts
```

Expected: FAIL during module resolution because the payload and merge helpers do not exist.

- [ ] **Step 3: Implement the request, mutation, and immutable merge helpers.**

Use the existing typed `apiPost` function and `ENDPOINTS` map. Do not edit `api/client.ts`, the Zustand store schema, or backend files. The mutation must surface the backend's formatted `422` error unchanged. The endpoint constant is already added by Task 1; do not duplicate it.

- [ ] **Step 4: Run the request tests and verify they pass.**

```bash
npm test -- --run tests/unit/features/results/panelCountAdjustment.test.ts
```

Expected: payload, merge, and immutability tests pass.

- [ ] **Step 5: Commit the panel-adjustment flow.**

```bash
git add frontend/src/features/results/panelCountAdjustment.ts frontend/src/features/results/hooks/useAdjustPanelCount.ts frontend/src/shared/api/endpoints.ts frontend/tests/unit/features/results/panelCountAdjustment.test.ts
git commit -m "feat: add typed panel adjustment flow"
```

---

### Task 5: Build the four pages, panel-only preview, route guards, and focused page tests

**Files:**

- Create: `frontend/src/features/results/components/PanelLayoutPreview.tsx`
- Create: `frontend/src/features/results/ResultsPage.tsx`
- Create: `frontend/src/features/results/EditLayoutPage.tsx`
- Create: `frontend/src/features/results/index.ts`
- Create: `frontend/src/features/recommendation/RecommendationPage.tsx`
- Create: `frontend/src/features/recommendation/WhyPage.tsx`
- Modify: `frontend/src/features/recommendation/index.ts`
- Modify: `frontend/src/app/router.tsx`
- Create: `frontend/tests/unit/features/results/ResultsPage.test.tsx`
- Create: `frontend/tests/unit/features/results/EditLayoutPage.test.tsx`
- Create: `frontend/tests/unit/features/recommendation/RecommendationPage.test.tsx`
- Create: `frontend/tests/unit/features/recommendation/WhyPage.test.tsx`
- Consume: `FlowLayout`, `ContentScreen`, `MapSurface`, `Slider`, `HairlineList`, `HairlineRow`, `Button`, `ButtonLink`, `Reveal`, and `Eyebrow`

**Interfaces:**

- All four pages read the typed result through the feature boundary and redirect to `ROUTE_PATHS.energy` with `replace` when it is absent.
- `PanelLayoutPreview` accepts `{ roofCoordinates, panels, status? }` and renders a responsive SVG inside `MapSurface`; it has no provider or flux dependency.
- `ResultsPage` renders the PRD-required fields and passes the current panel count/dimensions to `PanelLayoutPreview`.
- `EditLayoutPage` keeps local `requestedPanelCount`, `candidateAdjustment`, `adjustmentError`, and `isSaving` state. Slider changes debounce the Section 2 mutation; Save commits only the latest successful candidate through `setResult` and then navigates to `/results`.
- `RecommendationPage` uses `buildInvestmentDefaults`, `buildInvestmentSliderBounds`, `clampInvestmentInputs`, and `computeInvestmentProjection`; its local controls never write to the assessment store.
- `WhyPage` uses `buildPredictionConfidence` and never constructs demo confidence data.

- [ ] **Step 1: Write failing route/page tests for missing results and fixture rendering.**

Use `MemoryRouter`, `AppProviders`, and `useAssessmentStore.getState().setResult(...)` in each test. Import the fixture from `../../../fixtures/assessmentFixture`. Assert that a missing result redirects with React Router's `<Navigate to={ROUTE_PATHS.energy} replace />`, and that a seeded fixture renders representative values such as `₱1,892`, `3.6 kW`, `8 panels`, and `9.5 years`. The redirect assertion should use a memory router with an `/energy` destination and wait for `router.state.location.pathname` to become `/energy`, so it verifies navigation rather than just a visible link.

For the layout page, mock `useAdjustPanelCount` with a successful response and a rejected `422` response. Assert the result store remains at 8 panels before Save and becomes 10 only after Save succeeds.

Use this route-guard shape in each page rather than adding a shared guard abstraction:

```tsx
if (!result) {
  return <Navigate to={ROUTE_PATHS.energy} replace />;
}
```

- [ ] **Step 2: Run the page tests and verify the missing-component failure.**

```bash
npm test -- --run tests/unit/features/results/ResultsPage.test.tsx tests/unit/features/results/EditLayoutPage.test.tsx tests/unit/features/recommendation/RecommendationPage.test.tsx tests/unit/features/recommendation/WhyPage.test.tsx
```

Expected: FAIL because the four pages and panel preview do not exist.

- [ ] **Step 3: Implement the panel-only SVG preview.**

Normalize roof and panel coordinates into a stable `viewBox`, draw the roof polygon, draw each panel footprint, and expose a text alternative containing the panel count. Use the existing `MapSurface`; do not add a map library or flux import.

- [ ] **Step 4: Implement `ResultsPage` and its route guard.**

Port the old `FlowLayout` structure and visual hierarchy. Replace the old flux preload branch with the panel-only preview. Add the required recommendation, financial, budget, assumption, exclusion, limitation, and provisional-status sections using the Task 1 formatters and shared hairline components.

- [ ] **Step 5: Implement `EditLayoutPage` and candidate adjustment rendering.**

Use `resolveLayoutContext` and `layoutPanelsInPolygon` for the preview. Debounce slider changes with a local `useEffect` timer; cancel the timer on cleanup. Disable Save until the current count has a successful candidate response. Display the candidate's returned financial values and backend error text. Keep the global result unchanged until Save.

Use the target `FlowLayout` prop name `onNext`, not the old `onNextClick` prop.

- [ ] **Step 6: Implement `RecommendationPage` and `WhyPage`.**

Port the old `ContentScreen` composition, sliders, timeline, confidence rows, advanced-analysis details, and CTA links. Remove demo defaults and make fallback wording conditional on the stored result's resource/shading fields. Show 0% escalation and 0.5% degradation in the investment assumptions copy.

- [ ] **Step 7: Replace the four pending route entries.**

Import the new page modules from their feature barrels in `frontend/src/app/router.tsx` and replace only the `/results`, `/results/layout`, `/invest`, and `/why` `PendingScreen` elements. Leave upstream pending routes untouched.

- [ ] **Step 8: Run focused page tests and verify they pass.**

```bash
npm test -- --run tests/unit/features/recommendation tests/unit/features/results
```

Expected: seeded pages render the fixture values, missing results recover to `/energy`, candidate adjustment errors preserve the original result, and successful Save commits the candidate.

- [ ] **Step 9: Commit the result experience.**

```bash
git add frontend/src/features/recommendation frontend/src/features/results frontend/src/app/router.tsx frontend/tests/unit/features/recommendation frontend/tests/unit/features/results
git commit -m "feat: add recommendation and results screens"
```

---

### Task 6: Run full frontend verification and update the Jezreel checklist

**Files:**

- Verify: all Section 3 frontend files and tests in `Kahayag-Final/kahayag`
- Modify: `/Users/jeonellumbab/Developer/Kahayag-main/Kahayag-old/JEZREEL_CHECKLIST.md`

**Interfaces:**

- Consumes: the four implemented pages, typed result helpers, layout utilities, adjustment hook, and focused tests.
- Produces: verified frontend code on `agent/assessment-backend` and a Section 3 checklist record with exact commands, decisions, and deferred flux work.

- [ ] **Step 1: Run typecheck, lint, focused tests, and production build.**

From `/private/tmp/kahayag-assessment-backend/frontend`:

```bash
npm run typecheck
npm run lint
npm test -- --run tests/unit/features/recommendation tests/unit/features/results
npm run build
```

Expected: all commands exit 0. The browser end-to-end journey remains deferred because the upstream input routes are still pending on the target branch.

- [ ] **Step 2: Inspect the final target diff.**

```bash
git diff --check origin/agent/assessment-backend..HEAD
git status --short
git log --oneline --decorate --max-count=8
```

Expected: the Section 3 frontend files and tests are added on top of the existing Section 2 worktree changes; no new flux, backend, store-schema, or unrelated Section 3 changes appear.

- [ ] **Step 3: Record Section 3 completion in the checklist.**

In `Kahayag-old/JEZREEL_CHECKLIST.md`, mark the Section 3 items `[x]` only after the commands pass. Add a dated comment containing:

- the Section 2 base branch and target worktree;
- the four implemented routes;
- the fixture-backed focused test and build commands with results;
- the 0% escalation decision;
- the immutable candidate adjustment behavior;
- the explicit Section 4 shading/flux deferral and no-flux fallback.

Leave Section 4 unchecked.

- [ ] **Step 4: Commit any checklist-only handoff separately if needed.**

From the old reference repository:

```bash
git -C /Users/jeonellumbab/Developer/Kahayag-main/Kahayag-old diff --check
git -C /Users/jeonellumbab/Developer/Kahayag-main/Kahayag-old status --short
```

Do not stage unrelated old-repository changes. If the checklist is committed, use:

```bash
git -C /Users/jeonellumbab/Developer/Kahayag-main/Kahayag-old add JEZREEL_CHECKLIST.md
git -C /Users/jeonellumbab/Developer/Kahayag-main/Kahayag-old commit -m "docs: record recommendation results frontend handoff"
```

---

## Final handoff

After Task 6, report:

- target branch and commit range;
- routes and files added;
- exact verification commands and outputs;
- Section 4 flux/shading deferral;
- any remaining dependency on the upstream input screens or another owner's API handoff.
