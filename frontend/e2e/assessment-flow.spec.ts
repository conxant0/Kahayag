// Walks the input journey in a browser: guard, bill, submission, results.
import { expect, test } from "@playwright/test";

import {
  mockAssessmentApi,
  mockAssessmentFailure,
  SESSION_STORAGE_KEY,
  seedTracedSession,
} from "./helpers/mockAssessmentApi";

const BILL_LABEL = "Monthly electricity bill in pesos";

test.describe("the assessment journey", () => {
  test("a cold session cannot open a step it has no answers for", async ({
    page,
  }) => {
    await mockAssessmentApi(page);

    await page.goto("/loading");

    // The earliest gap, not the nearest: nothing is stored, so the homeowner
    // is sent to pick a property rather than to type a bill for a roof that
    // was never traced.
    await expect(page).toHaveURL(/\/locate$/);
  });

  test("a session with a roof but no bill is sent back to the energy step", async ({
    page,
  }) => {
    await mockAssessmentApi(page);
    await seedTracedSession(page);

    await page.goto("/loading");

    await expect(page).toHaveURL(/\/energy$/);
  });

  test("a bill produces an assessment and lands on the results", async ({
    page,
  }) => {
    const calls = await mockAssessmentApi(page);
    await seedTracedSession(page);

    await page.goto("/energy");
    await expect(page.getByLabel(BILL_LABEL)).toBeVisible();

    await page.getByLabel(BILL_LABEL).fill("4800");
    await expect(page.getByLabel(BILL_LABEL)).toHaveValue("4,800");

    await page.getByRole("link", { name: "See my results" }).click();

    // Past /loading, which submits and goes straight on: this assessment
    // carries no shading data, so there is no panel layout to improve and no
    // flux map worth fetching.
    await expect(page).toHaveURL(/\/results$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    expect(calls.assessments).toBeGreaterThan(0);
    // Asserted rather than assumed. Reading this as "flux failed and the
    // journey carried on regardless" is what let the refusal below go
    // unexercised while the suite looked like it covered the failure.
    expect(calls.fluxPrepare).toBe(0);
  });

  test("the way on stays shut until a bill is entered", async ({ page }) => {
    await mockAssessmentApi(page);
    await seedTracedSession(page);

    await page.goto("/energy");

    const next = page.getByRole("link", { name: "See my results" });
    await expect(next).toHaveAttribute("aria-disabled", "true");

    await page.getByLabel(BILL_LABEL).fill("4800");

    await expect(next).not.toHaveAttribute("aria-disabled", "true");
  });

  test("refreshing during the input journey restores property, roof and energy", async ({
    page,
  }) => {
    await mockAssessmentApi(page);
    await seedTracedSession(page);

    await page.goto("/energy");
    await page.getByLabel(BILL_LABEL).fill("6200");
    await page.getByText("Add a budget or your own rate").click();
    await page.getByLabel("Budget (optional)").fill("250000");

    await page.reload();

    // The step still opens, which means the guard found a property and a roof
    // behind it; had either been lost the reload would have bounced away.
    await expect(page).toHaveURL(/\/energy$/);
    await expect(page.getByLabel(BILL_LABEL)).toHaveValue("6,200");

    const stored = await page.evaluate(
      (key) => window.sessionStorage.getItem(key),
      SESSION_STORAGE_KEY,
    );
    const session = JSON.parse(stored ?? "{}");

    expect(session.selectedProperty?.address).toBe("1 Some Street, Cebu City");
    expect(session.roofPolygon?.coordinates).toHaveLength(4);
    expect(session.energyInputs?.monthlyBillPhp).toBe(6200);
    expect(session.energyInputs?.budgetPhp).toBe(250000);
  });

  test("a refused flux map leaves the assessment usable", async ({ page }) => {
    // Shading is what makes the app want a flux map at all, so an assessment
    // that carries it is the only way to reach the refusal.
    const calls = await mockAssessmentApi(page, { withShading: true });
    await seedTracedSession(page, {
      energyInputs: {
        monthlyBillPhp: 4800,
        electricityRatePhpPerKwh: 12,
        budgetPhp: null,
      },
    });

    await page.goto("/loading");

    await expect(
      page.getByText("We couldn’t prepare the solar flux map."),
    ).toBeVisible({ timeout: 30_000 });
    expect(calls.fluxPrepare).toBeGreaterThan(0);

    // The screen does not carry on by itself, and should not: the overlay was
    // asked for, so the homeowner is told it is missing and given the choice.
    // What the product promises is that the choice exists, not that the
    // failure is silent.
    await page
      .getByRole("button", { name: "Continue without flux map" })
      .click();

    await expect(page).toHaveURL(/\/results$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("a failed assessment explains itself and offers a way back", async ({
    page,
  }) => {
    await mockAssessmentFailure(page);
    await seedTracedSession(page, {
      energyInputs: {
        monthlyBillPhp: 4800,
        electricityRatePhpPerKwh: 12,
        budgetPhp: null,
      },
    });

    await page.goto("/loading");

    await expect(
      page.getByText("We couldn’t finish the assessment."),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("link", { name: "Back to your bill" }),
    ).toHaveAttribute("href", "/energy");
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});
