# Section 4 Solar Verification Design

## Goal

Complete the last Section 4 verification item by requesting Google Solar data
layers at the minimum `BASE` quality, proving the provider request contract,
and recording live Solar/GeoTIFF/browser results for the representative
Philippine property.

## Scope

- Change `GoogleSolarProvider.get_data_layers` to send
  `requiredQuality=BASE`.
- Add one focused provider test mocking `httpx.get` and asserting the complete
  `dataLayers:get` request parameters.
- Run the backend test suite and Ruff.
- Exercise Building Insights, flux preparation, annual and mask GeoTIFF proxy
  endpoints, and the frontend results overlay with the configured backend key.
- Verify heatmap alignment, legend range, visible panels, toggle behavior, and
  non-blocking fallback. If Cebu has no coverage, record a covered Philippine
  residential roof coordinate instead.
- Update the separate `Kahayag-old/JEZREEL_CHECKLIST.md` record. Do not copy
  credentials or `.env` files into the target repository.

## Design

The provider remains the only production change: its existing `httpx.get`
boundary emits the same URL, coordinates, radius, view, and key with the
quality floor lowered from `HIGH` to `BASE`. The test calls the real provider
method and replaces only the external HTTP request, so a wrong parameter or
missing response validation fails at the integration boundary.

Live verification will use the existing FastAPI routes and frontend results
flow. The optional visualization continues to load after the core result and
is allowed to fall back when Solar data is unavailable. No new cache,
abstraction, dependency, or browser behavior is introduced.

## Verification record

Commands and observed imagery quality, overlay alignment, legend values,
visible panels, toggle states, fallback behavior, and any fallback coordinate
will be appended to the checklist after the live run.
