// Defines a flip compare card for an uploaded installer quote.
import { useState, type KeyboardEvent, type MouseEvent } from "react";

import { ROUTE_PATHS } from "../../app/routePaths";
import { Button, ButtonLink } from "../../shared/components/ui";
import { cn } from "../../shared/lib/cn";
import { useDesignStore } from "../../state/designStore";
import {
  compareFlipCardClass,
  compareFlipFaceBackClass,
  compareFlipFaceClass,
  compareFlipInnerClass,
  compareMoneyClass,
} from "./CompareCardsGrid";
import { QuoteAuditModal } from "./QuoteAuditModal";
import type { CompareQuoteView } from "./quoteCompareViewModel";

function SpecRows({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <dl className="flex flex-col">
      {rows.map((row, index) => (
        <div key={row.label}>
          {index > 0 ? <div className="h-px bg-hairline" /> : null}
          <div className="flex items-center justify-between gap-3 py-2.5 text-[12.5px]">
            <dt className="shrink-0 font-sans font-normal text-tertiary">{row.label}</dt>
            <dd className="min-w-0 break-words text-right font-sans font-semibold text-ink">
              {row.value}
            </dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

function verdictBadgeClass(tone: CompareQuoteView["verdictTone"]): string {
  switch (tone) {
    case "positive":
      return "bg-[#e8f5ec] text-green-800";
    case "caution":
      return "bg-[#fff4cc] text-[#7a5c00]";
    default:
      return "bg-[#fff0eb] text-ember";
  }
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
        <span
          className={cn(
            "rounded-pill px-[11px] py-1.5 font-sans text-[10.5px] font-semibold tracking-[0.5px]",
            verdictBadgeClass(view.verdictTone),
          )}
        >
          {view.verdictLabel}
        </span>
      </div>
    </header>
  );
}

function QuoteCardFooter({
  view,
  onRemove,
  onSelectQuote,
  onViewAudit,
}: {
  view: CompareQuoteView;
  onRemove: (filename: string) => void;
  onSelectQuote?: (filename: string) => void;
  onViewAudit: () => void;
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
      <p className={compareMoneyClass}>{view.quotedTotalLabel}</p>
      <div className="mt-5 flex flex-col gap-2" onClick={stopFlip}>
        <Button
          fullWidth
          variant="ghost"
          className="h-[52px] border-hairline bg-[#fff4cc] text-[14px] text-[#7a5c00] hover:border-[#7a5c00]/30"
          onClick={onViewAudit}
        >
          View audit review
        </Button>
        {onSelectQuote ? (
          <Button
            fullWidth
            className="h-[52px] text-[14px]"
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

const quoteFaceClass = cn(
  compareFlipFaceClass,
  "border border-hairline shadow-[0px_3px_10px_0px_rgba(26,23,18,0.04)]",
);

const quoteFaceBackClass = cn(
  compareFlipFaceBackClass,
  "border border-hairline shadow-[0px_3px_10px_0px_rgba(26,23,18,0.04)]",
);

function QuoteOverviewFace({
  view,
  barTone,
  onRemove,
  onSelectQuote,
  onViewAudit,
}: {
  view: CompareQuoteView;
  barTone: string;
  onRemove: (filename: string) => void;
  onSelectQuote?: (filename: string) => void;
  onViewAudit: () => void;
}) {
  return (
    <>
      <QuoteCardHeader view={view} />

      <div className="mt-5 rounded-[14px] bg-[#fbf6e8] px-[18px] py-4">
        <p className="font-sans text-[9.5px] font-medium tracking-[1.1px] text-tertiary uppercase">
          Quoted total
        </p>
        <p className="mt-1 break-words font-serif text-[1.75rem] font-medium leading-none text-cobalt">
          {view.quotedTotalLabel}
        </p>
        <div className="my-3.5 h-px bg-hairline" />
        <p className="font-sans text-[9.5px] font-medium tracking-[1.1px] text-tertiary uppercase">
          Compared to our estimate
        </p>
        <p className="mt-1 break-words font-serif text-[1.375rem] font-medium leading-snug text-ink">
          {view.benchmarkDeltaLabel}
        </p>
      </div>

      <div className="mt-5">
        <SpecRows rows={view.overviewSpecs} />
      </div>

      <div className="mt-5 rounded-[14px] border border-hairline px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <p className="font-sans text-xs font-medium text-secondary">
            How the price compares
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
        <p className="mt-2.5 line-clamp-3 font-serif text-[13px] leading-[19px] text-secondary italic">
          “{view.insight}”
        </p>
      </div>

      <p className="mt-4 font-sans text-[11px] font-medium text-cobalt opacity-0 transition-opacity duration-300 group-hover/card:opacity-100">
        Click to view technical specs
      </p>

      <QuoteCardFooter
        view={view}
        onRemove={onRemove}
        onSelectQuote={onSelectQuote}
        onViewAudit={onViewAudit}
      />
    </>
  );
}

function QuoteTechnicalFace({
  view,
  onRemove,
  onSelectQuote,
  onViewAudit,
}: {
  view: CompareQuoteView;
  onRemove: (filename: string) => void;
  onSelectQuote?: (filename: string) => void;
  onViewAudit: () => void;
}) {
  return (
    <>
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
        onRemove={onRemove}
        onSelectQuote={onSelectQuote}
        onViewAudit={onViewAudit}
      />
    </>
  );
}

export function QuoteCompareCard({
  view,
  onSelectQuote,
}: {
  view: CompareQuoteView;
  onSelectQuote?: (filename: string) => void;
}) {
  const removeQuoteAuditResult = useDesignStore((state) => state.removeQuoteAuditResult);
  const [isFlipped, setIsFlipped] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

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
    <>
      <article className={compareFlipCardClass}>
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
          className={cn(compareFlipInnerClass, isFlipped && "[transform:rotateY(180deg)]")}
        >
          <div aria-hidden={isFlipped} className={cn("z-[2]", quoteFaceClass)}>
            <QuoteOverviewFace
              view={view}
              barTone={barTone}
              onRemove={removeQuoteAuditResult}
              onSelectQuote={onSelectQuote}
              onViewAudit={() => setAuditOpen(true)}
            />
          </div>

          <div aria-hidden={!isFlipped} className={quoteFaceBackClass}>
            <QuoteTechnicalFace
              view={view}
              onRemove={removeQuoteAuditResult}
              onSelectQuote={onSelectQuote}
              onViewAudit={() => setAuditOpen(true)}
            />
          </div>
        </div>
      </article>

      <QuoteAuditModal
        open={auditOpen}
        view={view}
        onClose={() => setAuditOpen(false)}
      />
    </>
  );
}
