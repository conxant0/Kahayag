// Defines browser-level API stubs and session seeding for the e2e specs.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";

const FIXTURE_URL = new URL(
  "../../../backend/tests/fixtures/completed_assessment.json",
  import.meta.url,
);

/**
 * The same completed assessment the backend suites assert against.
 *
 * Read from the backend's fixture rather than copied here: a stub that drifts
 * from the real response shape passes while the app would break against the
 * service it is pretending to be.
 */
export const completedAssessment = JSON.parse(
  readFileSync(fileURLToPath(FIXTURE_URL), "utf8"),
) as Record<string, unknown>;

/** Matches the store's key. A different key would seed nothing, silently. */
export const SESSION_STORAGE_KEY = "kahayag-assessment-session";

export type SeededSession = {
  selectedProperty: Record<string, unknown>;
  roofPolygon: Record<string, unknown>;
  energyInputs: Record<string, unknown>;
};

const PROPERTY = {
  placeId: "e2e-place",
  name: "Test house",
  address: "1 Some Street, Cebu City",
  latitude: 10.3157,
  longitude: 123.8854,
  source: "search",
};

/** A square roof, large enough that the domain has area to fit panels onto. */
const ROOF = {
  id: "e2e-roof",
  propertyId: "e2e-place",
  coordinates: [
    { latitude: 10.3157, longitude: 123.8854 },
    { latitude: 10.31581, longitude: 123.8854 },
    { latitude: 10.31581, longitude: 123.88551 },
    { latitude: 10.3157, longitude: 123.88551 },
  ],
  areaSquareMeters: 140,
  perimeterMeters: 48,
  createdAt: "2026-01-01T00:00:00.000Z",
};

export const seededSession: SeededSession = {
  selectedProperty: PROPERTY,
  roofPolygon: ROOF,
  energyInputs: {
    monthlyBillPhp: null,
    electricityRatePhpPerKwh: 12,
    budgetPhp: null,
  },
};

/**
 * Puts a located property and a traced roof into the session.
 *
 * The two steps before /energy are driven by the Google Maps JavaScript API:
 * the satellite imagery is what a homeowner traces on, and without a key the
 * trace screen correctly refuses to pretend otherwise. Rather than stub the
 * vendor's canvas, these specs start from the state those steps produce — the
 * same shape the app itself writes and restores — and cover the part of the
 * journey that is ours.
 *
 * Written through `page.evaluate` rather than an init script on purpose: an
 * init script would re-seed on every navigation, and the reload spec would pass
 * without the app persisting anything at all.
 */
export async function seedTracedSession(
  page: Page,
  overrides: Partial<SeededSession> = {},
): Promise<void> {
  await page.goto("/");
  await page.evaluate(
    ([key, session]) => {
      window.sessionStorage.setItem(key as string, JSON.stringify(session));
    },
    [SESSION_STORAGE_KEY, { ...seededSession, ...overrides }] as const,
  );
}

/**
 * Answers the assessment endpoints from the fixture.
 *
 * Everything under `/api/` is routed, so a call this suite did not anticipate
 * fails loudly as an unroutable request rather than silently reaching a real
 * service and making the run depend on the network.
 */
export async function mockAssessmentApi(page: Page): Promise<void> {
  await page.route("**/api/v1/assessments", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(completedAssessment),
    });
  });

  // The flux map is optional by design, and preparing it needs Google's solar
  // rasters. Refusing it here exercises the path the product actually promises:
  // the assessment stands on its own and the journey continues without it.
  await page.route("**/api/v1/solar/flux/**", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Flux is unavailable in this run." }),
    });
  });
}

/** Fails the assessment call, for the specs that assert the error path. */
export async function mockAssessmentFailure(page: Page): Promise<void> {
  await page.route("**/api/v1/assessments", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ detail: "The assessment service is down." }),
    });
  });
}
