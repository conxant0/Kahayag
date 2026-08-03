// Verifies the landing page's document structure, disclosures, and entry points.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { LandingPage } from "../../../../src/features/landing";

function renderLanding() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );
}

describe("LandingPage", () => {
  it("carries exactly one top-level heading", () => {
    const { container } = renderLanding();

    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "kahayag",
    );
  });

  it("states the promise in the hero", () => {
    renderLanding();

    expect(
      screen.getByText("What is the sun worth on your roof?"),
    ).toBeInTheDocument();
  });

  it("opens the flow from both calls to action", () => {
    renderLanding();

    const entries = screen.getAllByRole("link", { name: "Get started" });

    expect(entries).toHaveLength(2);
    for (const entry of entries) {
      expect(entry).toHaveAttribute("href", "/locate");
    }
  });

  it("offers a skip link into the one main landmark", () => {
    const { container } = renderLanding();

    expect(
      screen.getByRole("link", { name: "Skip to content" }),
    ).toHaveAttribute("href", "#main");
    expect(container.querySelectorAll("#main")).toHaveLength(1);
  });

  it("names every section by its own heading", () => {
    const { container } = renderLanding();

    const sections = [
      "the-gap",
      "step-01",
      "step-02",
      "step-03",
      "who-its-for",
      "closing-cta",
    ];

    for (const id of sections) {
      expect(container.querySelector(`h2#${id}`)).not.toBeNull();
      expect(
        container.querySelector(`section[aria-labelledby="${id}"]`),
      ).not.toBeNull();
    }
  });

  it("opens the first gap row and leaves the rest closed", () => {
    renderLanding();

    const rows = screen
      .getAllByRole("button")
      .filter((button) => button.hasAttribute("aria-expanded"));

    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveAttribute("aria-expanded", "true");
    expect(rows[1]).toHaveAttribute("aria-expanded", "false");
    expect(rows[2]).toHaveAttribute("aria-expanded", "false");
  });

  it("hands a gap row's disclosure over when another is opened", async () => {
    renderLanding();

    const rows = screen
      .getAllByRole("button")
      .filter((button) => button.hasAttribute("aria-expanded"));

    await userEvent.click(rows[1]);

    expect(rows[0]).toHaveAttribute("aria-expanded", "false");
    expect(rows[1]).toHaveAttribute("aria-expanded", "true");
  });

  it("points each gap row at the panel it controls", () => {
    const { container } = renderLanding();

    const rows = screen
      .getAllByRole("button")
      .filter((button) => button.hasAttribute("aria-expanded"));

    for (const row of rows) {
      const panelId = row.getAttribute("aria-controls");
      expect(panelId).toBeTruthy();
      expect(
        container.querySelector(`#${CSS.escape(panelId ?? "")}`),
      ).not.toBeNull();
    }
  });

  it("describes the evidence photographs and leaves brand art decorative", () => {
    const { container } = renderLanding();

    const described = [...container.querySelectorAll("img")].filter(
      (image) => (image.getAttribute("alt") ?? "") !== "",
    );

    // One photograph behind each of the three claims.
    expect(described).toHaveLength(3);
    for (const image of described) {
      expect(image.getAttribute("alt")?.length ?? 0).toBeGreaterThan(20);
    }
  });

  it("exposes the settled savings figure rather than the ticking one", () => {
    const { container } = renderLanding();

    const stepTwo = container.querySelector(
      'section[aria-labelledby="step-02"]',
    );

    expect(stepTwo).not.toBeNull();
    // The animated number is hidden from assistive tech; a visually hidden
    // span carries the final value so it is never announced mid-count.
    expect(
      within(stepTwo as HTMLElement).getByText("₱4,850"),
    ).toBeInTheDocument();
  });

  it("attributes the pull-quote to a person", () => {
    renderLanding();

    expect(screen.getByText(/Rhanzel E\./)).toBeInTheDocument();
  });
});
