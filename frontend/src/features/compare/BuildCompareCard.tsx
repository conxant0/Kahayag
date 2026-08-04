// Defines a solver-backed build card for the compare screen.
import { Button, ButtonLink } from "../../shared/components/ui";
import { cn } from "../../shared/lib/cn";
import { ROUTE_PATHS } from "../../app/routePaths";
import type { CompareMode } from "./compareTypes";
import type { CompareBuildView } from "./compareViewModel";

function SparkIcon() {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M6 0.5L6.85 4.15L10.5 5L6.85 5.85L6 9.5L5.15 5.85L1.5 5L5.15 4.15L6 0.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function BuildCompareCard({
  view,
  mode,
  onSelect,
}: {
  view: CompareBuildView;
  mode: CompareMode;
  onSelect: (buildId: string) => void;
}) {
  const { build, isSuggested } = view;
  const rows = mode === "overview" ? view.overviewSpecs : view.technicalRows;

  return (
    <article
      className={cn(
        "relative flex h-full min-h-0 flex-col rounded-[20px] bg-white p-6",
        isSuggested
          ? "border-[1.6px] border-sun shadow-[0px_8px_12px_rgba(26,23,18,0.1)]"
          : "border border-hairline shadow-[0px_3px_10px_0px_rgba(26,23,18,0.04)]",
      )}
    >
      {isSuggested ? (
        <div className="absolute -top-px right-4 flex items-center gap-1.5 rounded-bl-[10px] rounded-br-none rounded-tl-[10px] rounded-tr-[18px] bg-sun px-3 py-1.5 text-ink">
          <SparkIcon />
          <span className="font-sans text-[9.4px] font-semibold tracking-[1.1px] uppercase">
            BEST ALL-ROUND
          </span>
        </div>
      ) : null}

      <header className="flex flex-col gap-2.5">
        <h2 className="font-serif text-[26px] font-medium leading-none text-ink">
          {build.label}
        </h2>
        <div className="flex flex-wrap gap-[7px]">
          <span
            className={cn(
              "rounded-pill px-[11px] py-1.5 font-sans text-[10.5px] font-semibold tracking-[0.5px]",
              isSuggested
                ? "bg-[#fff4cc] text-[#7a5c00]"
                : "bg-[#f2eee4] text-secondary",
            )}
          >
            {view.trait}
          </span>
          <span className="rounded-pill border border-hairline px-[11px] py-1.5 font-sans text-[10.5px] font-semibold tracking-[0.5px] text-secondary">
            {view.capacityLabel}
          </span>
        </div>
      </header>

      {mode === "overview" ? (
        <div className="mt-5 rounded-[14px] bg-[#fbf6e8] px-[18px] py-4">
          <p className="font-sans text-[9.5px] font-medium tracking-[1.1px] text-tertiary uppercase">
            Monthly savings
          </p>
          <p className="mt-1 font-serif text-[34px] font-medium leading-none text-cobalt">
            {view.monthlySavingsLabel}
          </p>
          <div className="my-3.5 h-px bg-hairline" />
          <p className="font-sans text-[9.5px] font-medium tracking-[1.1px] text-tertiary uppercase">
            Payback period
          </p>
          <p className="mt-1 font-serif text-[26px] font-medium leading-none text-ink">
            {view.paybackLabel}
          </p>
        </div>
      ) : null}

      <dl className="mt-5 flex flex-col">
        {rows.map((row, index) => (
          <div key={row.label}>
            {index > 0 ? <div className="h-px bg-hairline" /> : null}
            <div className="flex items-center justify-between gap-3 py-2.5 text-[12.5px]">
              <dt className="font-sans font-normal text-tertiary">{row.label}</dt>
              <dd className="text-right font-sans font-semibold text-ink">
                {row.value}
              </dd>
            </div>
          </div>
        ))}
      </dl>

      {mode === "overview" ? (
        <div className="mt-5 rounded-[14px] border border-hairline px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <p className="font-sans text-xs font-medium text-secondary">
              Inverter utilisation
            </p>
            <p className="font-sans text-[12.5px] font-semibold text-cobalt">
              {view.utilisationPct.toFixed(0)}%
            </p>
          </div>
          <div className="mt-2.5 h-[5px] overflow-hidden rounded-pill bg-[#ede8dc]">
            <div
              className="h-full rounded-pill bg-cobalt"
              style={{
                width: `${Math.min(100, Math.max(0, view.utilisationPct))}%`,
              }}
            />
          </div>
          <p className="mt-2.5 font-serif text-[13px] leading-[19px] text-secondary italic">
            “{view.insight}”
          </p>
        </div>
      ) : null}

      <div className="mt-auto flex flex-col pt-5">
        <div className="h-px bg-hairline" />
        <p className="mt-[18px] font-sans text-[9.5px] font-medium tracking-[1.1px] text-tertiary uppercase">
          Estimated investment range
        </p>
        <p className="mt-1.5 whitespace-nowrap font-serif text-[clamp(1.125rem,2.6vw,1.625rem)] font-medium tabular-nums leading-none tracking-tight text-ink">
          {view.totalInvestmentLabel}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          {isSuggested ? (
            <Button fullWidth onClick={() => onSelect(build.id)}>
              Select this build
            </Button>
          ) : (
            <>
              <Button
                fullWidth
                onClick={() => onSelect(build.id)}
                variant="ghost"
                className="h-[52px] border-hairline bg-white text-[14px] text-ink hover:border-tertiary"
              >
                Select this build
              </Button>
              <ButtonLink
                to={ROUTE_PATHS.design}
                variant="ghost"
                fullWidth
                className="h-[52px] border-hairline bg-white text-[14px] text-ink hover:border-tertiary"
              >
                Adjust details
              </ButtonLink>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
