# Deterministic Solar Domain Transfer

## Context

`Kahayag-old` is the source of truth for Jezreel's rebuild. The target
`Kahayag-Final/kahayag` repository currently contains the scaffold and empty
solar-domain package. This slice implements checklist section 1 only:
framework-independent deterministic solar calculations and their focused
tests.

## Goal

Transfer the existing `Kahayag-old/backend/app/domain/solar` behavior into the
target with the smallest compatible diff, preserving the public helper names,
Decimal arithmetic, validation rules, recommendation semantics, and focused
tests.

## Scope

Add to `Kahayag-Final/kahayag/backend`:

- `app/domain/solar/assumptions.py`
- `app/domain/solar/entities.py`
- `app/domain/solar/errors.py`
- `app/domain/solar/geometry.py`
- `app/domain/solar/calculations.py`
- `app/domain/solar/recommendations.py`
- `app/domain/solar/resource.py`
- `app/domain/solar/value_objects.py`
- the existing solar-domain `__init__.py` implementation
- `tests/unit/domain/test_calculations.py`
- `tests/unit/domain/solar/test_geometry.py`
- `tests/unit/domain/solar/test_panel_capacity.py`

Reuse the target's existing shared schemas and `shapely` dependency. Do not
add assessment routes, provider code, frontend behavior, report logic, or
shading implementation in this slice.

## Shading boundary

`resource.py` exposes conversion from a shading analysis, but the target
shading module belongs to checklist section 4 and does not exist yet. Keep the
annotation available to type checkers while deferring its runtime import.
This lets fallback solar calculations and all section-1 tests import and run
without pulling section 4 into the change. Once section 4 supplies the
analysis object, the existing conversion function remains usable without an
API change.

## Preserved behavior

- Panel categories remain `standard-450` and `high-output-550` with the old
  dimensions and wattages.
- The nationwide fallback remains 5.0 peak-sun-hours/day with a 0.80
  performance ratio.
- Direct monthly consumption takes precedence over bill and tariff inputs.
- Bill-derived consumption uses the default tariff when no tariff is given.
- Capacity, generation, cost, savings, offset, payback, and budget helpers
  retain their existing rounding and flooring rules.
- Roof geometry retains duplicate-point cleanup, collinearity checks,
  self-intersection validation, minimum panel-area validation, and Decimal
  area output.
- Recommendation constraints retain roof, demand, and budget limits, the
  budget-shortfall one-panel behavior, limiting-constraint selection, and
  readable domain errors.

## Verification

Run from the target backend:

```bash
python -m pytest tests/unit/domain tests/unit/domain/solar -q
```

The checklist records the exact command and result. Section 1 is marked
`[~]` while the transfer is underway and `[x]` only after this focused suite
passes. Section 4 remains unimplemented and is explicitly noted as deferred.

