# Deterministic Solar Domain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transfer the deterministic solar domain and focused tests from `Kahayag-old` into `Kahayag-Final/kahayag` while preserving the old behavior.

**Architecture:** Keep all calculations in framework-independent modules under `backend/app/domain/solar`. Reuse the target's shared Pydantic schemas only at the geometry boundary, keep Decimal arithmetic and existing error semantics, and defer the missing shading type import so section 1 runs without section 4.

**Tech Stack:** Python 3.12+, Decimal, dataclasses, Shapely, pytest.

## Global Constraints

- `Kahayag-old` is the source of truth for this transfer.
- Preserve the old helper names, constants, dataclasses, Decimal arithmetic, rounding/flooring rules, validation rules, and recommendation semantics.
- Allow no-behavior lint cleanups required by the target toolchain; record each source-parity cleanup in the checklist for future ports.
- Reuse `Kahayag-Final/kahayag/backend/app/shared/schemas.py`; do not duplicate `GeoCoordinate`, `RoofPolygon`, or `RoofArea`.
- Use the existing `shapely` dependency; add no dependencies.
- Do not add assessment routes, provider code, frontend behavior, report logic, or shading implementation.
- Defer `ShadingAnalysis` to `TYPE_CHECKING` in `resource.py`; do not make runtime imports of the not-yet-ported shading module.
- Update `Kahayag-old/JEZREEL_CHECKLIST.md` with progress, comments, exact verification, and the section-4 deferral.
- Commit each completed task on the isolated branch so task reviews can inspect exact commit ranges; never push unless explicitly requested.

## File Map

- `backend/app/domain/solar/assumptions.py`: panel categories and shared solar/cost constants.
- `backend/app/domain/solar/entities.py`: framework-independent solar entity module placeholder from the source implementation.
- `backend/app/domain/solar/errors.py`: roof and feasibility domain exceptions.
- `backend/app/domain/solar/resource.py`: solar-resource value object, fallback, shading conversion, and annual yield helper.
- `backend/app/domain/solar/calculations.py`: demand, capacity, generation, offset, cost, savings, and payback helpers.
- `backend/app/domain/solar/recommendations.py`: roof/demand/budget limits, selected count, rationale, and adjustment helpers.
- `backend/app/domain/solar/geometry.py`: coordinate projection, polygon validation, area, and roof panel capacity.
- `backend/app/domain/solar/value_objects.py`: framework-independent value-object module placeholder from the source implementation.
- `backend/tests/unit/domain/test_calculations.py`: demand and financial behavior.
- `backend/tests/unit/domain/solar/test_geometry.py`: polygon validation and area behavior.
- `backend/tests/unit/domain/solar/test_panel_capacity.py`: explicit panel-area flooring behavior.
- `Kahayag-old/JEZREEL_CHECKLIST.md`: section-1 progress and verification record.

### Task 1: Mark the transfer in progress and port domain constants/resources

**Files:**

- Modify: `Kahayag-old/JEZREEL_CHECKLIST.md`
- Modify: `backend/app/domain/solar/__init__.py`
- Create: `backend/app/domain/solar/assumptions.py`
- Create: `backend/app/domain/solar/entities.py`
- Create: `backend/app/domain/solar/errors.py`
- Create: `backend/app/domain/solar/resource.py`
- Create: `backend/app/domain/solar/value_objects.py`

**Interfaces:**

- Produces `PANEL_CATEGORIES`, `PanelCategory`, `DEFAULT_PANEL_CATEGORY_ID`, the solar/cost constants, domain exceptions, `SolarResource`, `nationwide_fallback_solar_resource()`, `solar_resource_from_shading_analysis()`, and `annual_yield_per_kwp_kwh()` with the source signatures.

- [ ] **Step 1: Mark the first section-1 checklist item in progress.**

In `Kahayag-old/JEZREEL_CHECKLIST.md`, change the first checklist item under `## 1. Deterministic Solar Domain` from `[ ]` to `[~]`, set `Last updated` to `2026-08-03`, and add a comment that the target transfer is using `Kahayag-old` as the source of truth and shading is deferred to section 4. Leave the remaining section-1 items unchecked until their tasks finish.

- [ ] **Step 2: Port the source modules exactly.**

Use `apply_patch` to add the old contents of `assumptions.py`, `entities.py`, `errors.py`, `resource.py`, `value_objects.py`, and `__init__.py` to the target. Keep the module header comments and names unchanged.

- [ ] **Step 3: Add the deferred shading annotation boundary.**

In target `resource.py`, preserve the old function and fields, but use:

```python
from __future__ import annotations

from typing import TYPE_CHECKING, Literal

if TYPE_CHECKING:
    from app.domain.shading.analysis import ShadingAnalysis
```

This must leave `solar_resource_from_shading_analysis(analysis)` behavior unchanged while allowing the module to import before section 4 exists.

- [ ] **Step 4: Run an import smoke check.**

Run from `Kahayag-Final/kahayag/backend`:

```bash
python -c "from app.domain.solar.resource import nationwide_fallback_solar_resource; print(nationwide_fallback_solar_resource())"
```

Expected: the fallback `SolarResource` prints without a `ModuleNotFoundError`.

### Task 2: Port calculations and their tests

**Files:**

- Create: `backend/app/domain/solar/calculations.py`
- Create: `backend/tests/unit/domain/test_calculations.py`

**Interfaces:**

- Consumes: `assumptions.py` constants and `resource.py`'s `SolarResource`/yield helpers.
- Produces: `annualize_kwh()`, `calculate_system_capacity_kwp()`, `DemandEstimate`, `estimate_demand()`, `calculate_annual_generation_kwh()`, `calculate_consumption_offset_ratio()`, `calculate_cost_range_php()`, `calculate_base_cost_php()`, `calculate_annual_savings_php()`, `calculate_monthly_savings_php()`, and `calculate_payback_years()`.

- [ ] **Step 1: Add the source calculation tests.**

Copy `Kahayag-old/backend/tests/unit/domain/test_calculations.py` into the target with `apply_patch`, preserving tests for default/custom tariff conversion, direct-consumption precedence, frozen results, invalid inputs, cost, monthly savings, and payback.

- [ ] **Step 2: Run the calculation tests once.**

Run:

```bash
python -m pytest tests/unit/domain/test_calculations.py -q
```

Expected: collection fails because `app.domain.solar.calculations` is not yet present.

- [ ] **Step 3: Port the source calculation module.**

Port `Kahayag-old/backend/app/domain/solar/calculations.py` into the target with `apply_patch`. Preserve behavior; remove only the unused `PERFORMANCE_RATIO` import required for the target Ruff check. Do not replace Decimal operations with floats or change quantization/flooring.

- [ ] **Step 4: Run the calculation tests again.**

Run the same command. Expected: all calculation tests pass.

### Task 3: Port recommendations, geometry, and capacity tests

**Files:**

- Create: `backend/app/domain/solar/recommendations.py`
- Create: `backend/app/domain/solar/geometry.py`
- Create: `backend/tests/unit/domain/solar/test_geometry.py`
- Create: `backend/tests/unit/domain/solar/test_panel_capacity.py`

**Interfaces:**

- Consumes: target shared `GeoCoordinate`, `RoofPolygon`, and `RoofArea`, plus target solar assumptions/errors.
- Produces: recommendation helpers including `max_panels_by_budget()`, `max_panels_by_demand()`, `determine_panel_count()`, `build_rationale()`, `calculate_budget_gap_php()`, `validate_layout_panel_count()`, and `classify_adjustment_constraint()`; geometry helpers `calculate_roof_area()` and `max_panels_by_roof()`.

- [ ] **Step 1: Add the source geometry and capacity tests.**

Copy the old `test_geometry.py` and `test_panel_capacity.py` files into the target with `apply_patch`. Preserve coverage for square, triangle, concave, bowtie, collinear, duplicate, below-minimum, one-panel, and explicit flooring cases.

- [ ] **Step 2: Run the geometry tests once.**

Run:

```bash
python -m pytest tests/unit/domain/solar -q
```

Expected: collection fails because the target geometry module is not yet present.

- [ ] **Step 3: Port the source geometry and recommendation modules.**

Copy the old `geometry.py` and `recommendations.py` into the target with `apply_patch`. Preserve local equirectangular projection, Shapely validity checks, Decimal area conversion, and the source constraint tie-breaking behavior.

- [ ] **Step 4: Run the geometry and capacity tests again.**

Run the same command. Expected: all geometry and capacity tests pass.

### Task 4: Verify the complete section and close the checklist

**Files:**

- Modify: `Kahayag-old/JEZREEL_CHECKLIST.md`

**Interfaces:**

- Consumes: all target `app/domain/solar` modules and focused tests.
- Produces: a verified section-1 status and recorded deferred shading boundary.

- [ ] **Step 1: Run the complete focused suite.**

From `Kahayag-Final/kahayag/backend`, run:

```bash
python -m pytest tests/unit/domain tests/unit/domain/solar -q
```

Expected: all tests pass without external providers or the shading module.

- [ ] **Step 2: Run the backend lint on the touched domain/tests.**

Run:

```bash
ruff check app/domain/solar tests/unit/domain
```

Expected: no lint errors.

- [ ] **Step 3: Close all section-1 checklist items.**

Change all section-1 checklist items to `[x]`, replace the in-progress comment with the exact passing pytest and ruff commands, and state that shading analysis remains intentionally deferred to section 4. Leave sections 2–6 unchanged.

- [ ] **Step 4: Inspect the final diff.**

Run:

```bash
git -C Kahayag-Final/kahayag diff --check
git -C Kahayag-Final/kahayag status --short
```

Expected: no whitespace errors, and only the planned target domain/test/spec/plan files are changed in the target repository. The checklist change is in the separate `Kahayag-old` repository.
