// Defines a flip compare card for an uploaded installer quote.
import { useState, type KeyboardEvent, type MouseEvent } from "react";

import { ROUTE_PATHS } from "../../app/routePaths";
import { Button, ButtonLink } from "../../shared/components/ui";
import { cn } from "../../shared/lib/cn";
import { useDesignStore } from "../../state/designStore";
import type { CompareQuoteView } from "./quoteCompareViewModel";

function SpecRows({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <dl className="flex flex-col">
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
  );
}

function QuoteCardHeader({ view }: { view: CompareQuoteView }) {
  return (
    <header className="flex flex-col gap-2.5">
      <h2 className="line-clamp-2 font-serif text-[26px] font-medium leading-none text-ink">
        {view.label}
      </h2>
      <div className="flex flex-wrap gap-[7px]">
        <span className="rounded-pill bg-cobalt-wash px-[11px] py-1.5 font-sans text-[10.5px] font-semibold tracking-[0.5px] text-cobalt">
          {view.trait}
        </span>
        <span className="rounded-pill border border-hairline px-[11px] py-1.5 font-sans text-[10.5px] font-semibold tracking-[0.5px] text-secondary">
          {view.capacityLabel}
        </span>
      </div>
    </header>
  );
}

function QuoteCardFooter({
  view,
  onRemove,
  onSelectQuote,
}: {
  view: CompareQuoteView;
  onRemove: (filename: string) => void;
  onSelectQuote?: (filename: string) => void;
}) {
  const stopFlip = (event: MouseEvent) => {
    event.stopPropagation();
  };

  return (
    <div className="mt-auto flex flex-col pt-5">
      <div className="h-px bg-hairline" />
      <p className="mt-[18px] font-sans text-[9.5px] font-medium tracking-[1.1px] text-tertiary uppercase">
        Quoted total
      </p>
      <p className="mt-1.5 whitespace-nowrap font-serif text-[clamp(1.125rem,2.6vw,1.625rem)] font-medium tabular-nums leading-none tracking-tight text-ink">
        {view.quotedTotalLabel}
      </p>
      <div className="mt-5 flex flex-col gap-2" onClick={stopFlip}>
        {onSelectQuote ? (
          <Button
            fullWidth
            className="h-[52px] border-hairline bg-white text-[14px] text-ink hover:border-tertiary"
            onClick={() => onSelectQuote(view.result.filename)}
          >
            Use this quotation
          </Button>
        ) : null}
        {view.hasDiagram ? (
          <ButtonLink
            to={ROUTE_PATHS.design}
            fullWidth
            variant="ghost"
            className="h-[52px] border-hairline bg-white text-[14px] text-ink hover:border-tertiary"
          >
            View on canvas
          </ButtonLink>
        ) : null}
        <Button
          fullWidth
          variant="ghost"
          className="h-[52px] border-hairline bg-white text-[14px] text-ink hover:border-tertiary"
          onClick={() => onRemove(view.result.filename)}
        >
          Remove quote
        </Button>
      </div>
    </div>
  );
}

const cardSurfaceClass =
  "flex h-full flex-col rounded-[20px] border border-hairline bg-white p-6 shadow-[0px_3px_10px_0px_rgba(26,23,18,0.04)] [backface-visibility:hidden]";

export function QuoteCompareCard({
  view,
  onSelectQuote,
}: {
  view: CompareQuoteView;
  onSelectQuote?: (filename: string) => void;
}) {
  const removeQuoteAuditResult = useDesignStore((state) => state.removeQuoteAuditResult);
  const [isFlipped, setIsFlipped] = useState(false);

  const toggleFlip = () => {
    setIsFlipped((current) => !current);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleFlip();
    }
  };

  const barTone =
    view.benchmarkRatioPct > 105
      ? "bg-ember"
      : view.benchmarkRatioPct < 95
        ? "bg-green-700"
        : "bg-cobalt";

  return (
    <article className="group/card h-full [perspective:1200px]">
      <div
        role="button"
        tabIndex={0}
        aria-pressed={isFlipped}
        aria-label={
          isFlipped
            ? `${view.label} technical specs. Press to show overview.`
            : `${view.label} quote overview. Press to show technical specs.`
        }
        onClick={toggleFlip}
        onKeyDown={handleKeyDown}
        className={cn(
          "relative h-full w-full cursor-pointer text-left outline-none transition-[transform,box-shadow] duration-500 ease-brand [transform-style:preserve-3d] focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
          isFlipped && "[transform:rotateY(180deg)]",
          "group-hover/card:-translate-y-1.5 group-hover/card:shadow-[0px_18px_36px_rgba(26,23,18,0.12)]",
        )}
      >
        <div aria-hidden={isFlipped} className={cn("relative z-[2]", cardSurfaceClass)}>
          <QuoteCardHeader view={view} />

          <div className="mt-5 rounded-[14px] bg-[#fbf6e8] px-[18px] py-4">
            <p className="font-sans text-[9.5px] font-medium tracking-[1.1px] text-tertiary uppercase">
              Quoted total
            </p>
            <p className="mt-1 font-serif text-[34px] font-medium leading-none text-cobalt">
              {view.quotedTotalLabel}
            </p>
            <div className="my-3.5 h-px bg-hairline" />
            <p className="font-sans text-[9.5px] font-medium tracking-[1.1px] text-tertiary uppercase">
              vs Kahayag benchmark
            </p>
            <p className="mt-1 font-serif text-[22px] font-medium leading-snug text-ink">
              {view.benchmarkDeltaLabel}
            </p>
          </div>

          <div className="mt-5">
            <SpecRows rows={view.overviewSpecs} />
          </div>

          <div className="mt-5 rounded-[14px] border border-hairline px-4 py-3.5">
            <div className="flex items-center justify-between gap-3">
              <p className="font-sans text-xs font-medium text-secondary">
                Price vs benchmark
              </p>
              <p className="font-sans text-[12.5px] font-semibold text-cobalt">
                {view.benchmarkRatioPct.toFixed(0)}%
              </p>
            </div>
            <div className="mt-2.5 h-[5px] overflow-hidden rounded-pill bg-[#ede8dc]">
              <div
                className={cn(
                  "h-full rounded-pill transition-[width] duration-500 ease-brand",
                  barTone,
                )}
                style={{
                  width: `${Math.min(100, Math.max(0, view.benchmarkRatioPct))}%`,
                }}
              />
            </div>
            <p className="mt-2.5 font-serif text-[13px] leading-[19px] text-secondary italic">
              “{view.insight}”
            </p>
          </div>

          <p className="mt-4 font-sans text-[11px] font-medium text-cobalt opacity-0 transition-opacity duration-300 group-hover/card:opacity-100">
            Click to view technical specs
          </p>

          <QuoteCardFooter
            view={view}
            onRemove={removeQuoteAuditResult}
            onSelectQuote={onSelectQuote}
          />
        </div>

        <div
          aria-hidden={!isFlipped}
          className={cn(
            "absolute inset-0 [transform:rotateY(180deg)]",
            cardSurfaceClass,
          )}
        >
          <QuoteCardHeader view={view} />

          <p className="mt-5 font-sans text-[9.5px] font-medium tracking-[1.1px] text-tertiary uppercase">
            Technical specs
          </p>

          <div className="mt-3">
            <SpecRows rows={view.technicalRows} />
          </div>

          <p className="mt-4 font-sans text-[11px] font-medium text-cobalt">
            Click to return to overview
          </p>

          <QuoteCardFooter
            view={view}
            onRemove={removeQuoteAuditResult}
            onSelectQuote={onSelectQuote}
          />
        </div>
      </div>
    </article>
  );
}
