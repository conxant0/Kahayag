// Scans the screens a homeowner meets first for accessibility violations.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { mockAssessmentApi, seedTracedSession } from "./helpers/mockAssessmentApi";

/**
 * Colour contrast is excluded from the automated pass.
 *
 * The landing page paints type over photography and a gradient backdrop, where
 * axe samples a single pixel behind the text and reports whatever it lands on.
 * The failures that produces are about the sampling, not the design, and
 * leaving them in would train everyone to ignore the run.
 */
const DISABLED_RULES = ["color-contrast"];

test.describe("accessibility", () => {
  test("the landing page has no automatically detectable violations", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .disableRules(DISABLED_RULES)
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test("the energy step has no automatically detectable violations", async ({
    page,
  }) => {
    await mockAssessmentApi(page);
    await seedTracedSession(page);

    await page.goto("/energy");
    await expect(
      page.getByLabel("Monthly electricity bill in pesos"),
    ).toBeVisible();

    // Opened, so the fields inside the disclosure are scanned too rather than
    // passing by being collapsed.
    await page.getByText("Add a budget or your own rate").click();

    const results = await new AxeBuilder({ page })
      .disableRules(DISABLED_RULES)
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
