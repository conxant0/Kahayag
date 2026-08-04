import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { ROUTE_PATHS } from "../../app/routePaths";
import { ContentScreen } from "../../shared/components/layout";
import { DesignFlowStepper } from "../../shared/components/layout/DesignFlowStepper";
import { Button, ButtonLink, Chip, Eyebrow, HairlineList, HairlineRow } from "../../shared/components/ui";
import { useDesignStore } from "../../state/designStore";
import { compareBuilds, type CompareBuildView } from "./compareViewModel";

type CompareMode = "overview" | "technical";

function BuildCompareCard({
  view,
  rows,
  onSelect,
}: {
  view: CompareBuildView;
  rows: CompareBuildView["metrics"];
  onSelect: (buildId: string) => void;
}) {
  const { build, isSuggested } = view;

  return (
    <article
      className={[
        "flex flex-col gap-4 rounded-lg border bg-white p-5",
        isSuggested ? "border-sun border-2 shadow-[0_0_0_1px_var(--color-sun)]" : "border-hairline",
      ].join(" ")}
    >
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-serif text-xl text-ink">{build.label}</h2>
          {build.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-pill bg-sun px-2 py-0.5 font-sans text-[11px] font-semibold tracking-wide text-ink uppercase"
            >
              {tag}
            </span>
          ))}
        </div>
        <p className="font-sans text-sm text-secondary">{build.insight}</p>
      </header>

      <HairlineList>
        {rows.map((row) => (
          <HairlineRow key={row.label} label={row.label} value={row.value} />
        ))}
      </HairlineList>

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <Button fullWidth onClick={() => onSelect(build.id)}>
          Select
        </Button>
        <ButtonLink to={ROUTE_PATHS.design} variant="secondary" fullWidth>
          Adjust
        </ButtonLink>
      </div>
    </article>
  );
}

export function ComparePage() {
  const designSession = useDesignStore((state) => state.designSession);
  const selectBuild = useDesignStore((state) => state.selectBuild);
  const navigate = useNavigate();
  const [mode, setMode] = useState<CompareMode>("overview");

  if (!designSession) {
    return <Navigate to={ROUTE_PATHS.design} replace />;
  }

  const views = compareBuilds(designSession);

  const handleSelect = (buildId: string) => {
    selectBuild(buildId);
    navigate(ROUTE_PATHS.quotation);
  };

  return (
    <ContentScreen
      eyebrow="After AI design · Compare builds"
      title={
        <>
          Pick the build that <em className="font-normal italic">fits best.</em>
        </>
      }
      backHref={ROUTE_PATHS.design}
      backLabel="Back to design"
      aside={
        <div className="flex flex-col gap-6 print:hidden">
          <DesignFlowStepper activeStep={4} />

          <section className="flex flex-col gap-2">
            <Eyebrow tone="cobalt">View</Eyebrow>
            <div className="flex flex-wrap gap-2">
              <Chip selected={mode === "overview"} onClick={() => setMode("overview")}>
                Build overview
              </Chip>
              <Chip
                selected={mode === "technical"}
                onClick={() => setMode("technical")}
              >
                Technical specs
              </Chip>
            </div>
          </section>

          {designSession.last_solve?.rejections.length ? (
            <section className="flex flex-col gap-2" aria-label="Solver rejections">
              <Eyebrow tone="cobalt">Why some combos were rejected</Eyebrow>
              <ul className="flex flex-col gap-2">
                {designSession.last_solve.rejections.map((reason) => (
                  <li
                    key={`${reason.combo_key}-${reason.code}`}
                    className="rounded-lg border border-hairline bg-white p-3 font-sans text-sm text-secondary"
                  >
                    <p className="font-semibold text-ink">{reason.code}</p>
                    <p>{reason.message}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section
            className="flex flex-col gap-2 rounded-lg border border-dashed border-tertiary bg-white/60 p-4"
            aria-label="Quote auditor stub"
          >
            <Eyebrow>Quote auditor</Eyebrow>
            <p className="font-sans text-sm text-secondary">
              Upload a contractor quote to compare line items against this solver
              build. OCR parsing is not enabled in this demo.
            </p>
            <label className="flex cursor-pointer flex-col gap-1 font-sans text-sm text-secondary">
              <span className="font-semibold text-ink">Choose PDF or image</span>
              <input
                type="file"
                accept=".pdf,image/*"
                disabled
                className="text-sm"
              />
            </label>
          </section>

          <section
            className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-tertiary p-6 text-center"
            aria-label="Compare custom stub"
          >
            <span className="font-serif text-2xl text-tertiary-ink">+</span>
            <p className="font-sans text-sm text-secondary">
              Compare a custom constraint run (coming soon)
            </p>
          </section>
        </div>
      }
    >
      <DesignFlowStepper activeStep={4} />

      <section className="flex flex-col gap-2 xl:hidden">
        <Eyebrow tone="cobalt">View</Eyebrow>
        <div className="flex flex-wrap gap-2">
          <Chip selected={mode === "overview"} onClick={() => setMode("overview")}>
            Build overview
          </Chip>
          <Chip selected={mode === "technical"} onClick={() => setMode("technical")}>
            Technical specs
          </Chip>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {views.map((view) => (
          <BuildCompareCard
            key={view.build.id}
            view={view}
            rows={mode === "overview" ? view.metrics : view.technicalRows}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {designSession.last_solve?.rejections.length ? (
        <section
          className="flex flex-col gap-2 xl:hidden"
          aria-label="Solver rejections"
        >
          <Eyebrow tone="cobalt">Why some combos were rejected</Eyebrow>
          <ul className="flex flex-col gap-2">
            {designSession.last_solve.rejections.map((reason) => (
              <li
                key={`${reason.combo_key}-${reason.code}`}
                className="rounded-lg border border-hairline bg-white p-3 font-sans text-sm text-secondary"
              >
                <p className="font-semibold text-ink">{reason.code}</p>
                <p>{reason.message}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </ContentScreen>
  );
}
