import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { ROUTE_PATHS } from "../../app/routePaths";
import { DesignFlowStepper } from "../../shared/components/layout/DesignFlowStepper";
import { Eyebrow, SegmentedToggle } from "../../shared/components/ui";
import { useDesignStore } from "../../state/designStore";
import { BuildCompareCard } from "./BuildCompareCard";
import { CompareCustomCard } from "./CompareCustomCard";
import { QuoteAuditorCard } from "./QuoteAuditorCard";
import type { CompareMode } from "./compareTypes";
import { compareBuilds } from "./compareViewModel";

const MODE_OPTIONS = [
  { value: "overview", label: "Build overview" },
  { value: "technical", label: "Technical specs" },
] as const;

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
    <div className="flex min-h-svh flex-col bg-paper">
      <main
        id="main"
        className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-6 pt-8 pb-16 lg:px-16 lg:pt-16 lg:pb-[72px]"
      >
        <DesignFlowStepper activeStep={4} />

        <header className="flex flex-col items-start">
          <Eyebrow className="tracking-[1.4px]">
            After AI design · Compare builds
          </Eyebrow>
          <h1 className="mt-4 font-serif text-[36px] leading-tight font-medium text-ink lg:text-[54px] lg:leading-[60px]">
            Compare your options.
          </h1>
          <p className="mt-3.5 max-w-[620px] font-sans text-base leading-[26px] text-secondary">
            The real-world financial shape of three ways to build this roof —
            and room to test your own.
          </p>
        </header>

        <div className="flex justify-center">
          <SegmentedToggle
            ariaLabel="Compare view"
            value={mode}
            options={MODE_OPTIONS}
            onChange={setMode}
          />
        </div>

        <section
          aria-label="Build options"
          className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4 xl:items-stretch"
        >
          {views.map((view) => (
            <BuildCompareCard
              key={view.build.id}
              view={view}
              mode={mode}
              onSelect={handleSelect}
            />
          ))}
          <QuoteAuditorCard />
          <CompareCustomCard />
        </section>

        {designSession.last_solve?.rejections.length ? (
          <section
            className="flex flex-col gap-2"
            aria-label="Solver rejections"
          >
            <Eyebrow tone="cobalt">Why some combos were rejected</Eyebrow>
            <ul className="grid gap-2 md:grid-cols-2">
              {designSession.last_solve.rejections.map((reason) => (
                <li
                  key={`${reason.combo_key}-${reason.code}`}
                  className="rounded-[14px] border border-hairline bg-white p-4 font-sans text-sm text-secondary"
                >
                  <p className="font-semibold text-ink">{reason.code}</p>
                  <p>{reason.message}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </div>
  );
}
