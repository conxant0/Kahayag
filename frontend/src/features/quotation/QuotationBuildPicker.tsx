// Defines the build picker shown on the quotation step.
import { useMemo } from "react";

import { Eyebrow } from "../../shared/components/ui";
import { cn } from "../../shared/lib/cn";
import { useDesignStore } from "../../state/designStore";
import { compareBuilds } from "../compare/compareViewModel";

export function QuotationBuildPicker() {
  const designSession = useDesignStore((state) => state.designSession);
  const selectBuild = useDesignStore((state) => state.selectBuild);
  const views = useMemo(
    () => (designSession ? compareBuilds(designSession) : []),
    [designSession],
  );

  if (!designSession || views.length <= 1) {
    return null;
  }

  return (
    <section
      aria-label="Choose build for quotation"
      className="rounded-[16px] border border-hairline bg-white px-4 py-4 shadow-[0_3px_10px_rgba(26,23,18,0.04)] lg:px-5"
    >
      <Eyebrow>Choose build for quotation</Eyebrow>
      <p className="mt-2 font-sans text-[13px] leading-5 text-secondary">
        Switch between solver builds — the quote below updates to match.
      </p>
      <div
        role="radiogroup"
        aria-label="Build for quotation"
        className="mt-4 flex flex-col gap-2 sm:flex-row"
      >
        {views.map((view) => {
          const selected = view.build.id === designSession.active_build_id;
          return (
            <button
              key={view.build.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => selectBuild(view.build.id)}
              className={cn(
                "flex min-w-[12rem] flex-1 flex-col rounded-[12px] border px-4 py-3 text-left transition-colors duration-150 ease-brand",
                selected
                  ? "border-ink bg-[#fffdf5] shadow-[0_2px_8px_rgba(26,23,18,0.06)]"
                  : "border-hairline bg-[#fcfaf5] hover:border-tertiary hover:bg-white",
              )}
            >
              <span className="font-sans text-[14px] font-semibold text-ink">
                {view.build.label}
              </span>
              <span className="mt-1 font-sans text-[12px] text-secondary">
                {view.capacityLabel} · {view.totalInvestmentLabel}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
