import { useState } from "react";
import { Navigate } from "react-router-dom";

import { ROUTE_PATHS } from "../../app/routePaths";
import {
  DesignFlowStepper,
  StepPageHeader,
} from "../../shared/components/layout";
import {
  Button,
  ButtonLink,
  CtaArrow,
  Eyebrow,
} from "../../shared/components/ui";
import { cn } from "../../shared/lib/cn";
import { peso } from "../../shared/lib/currency";
import { useDesignStore } from "../../state/designStore";
import { getActiveBuild } from "../design/designViewModel";
import { AskEngineSidebar } from "./AskEngineSidebar";
import { QuotationBuildPicker } from "./QuotationBuildPicker";
import { WhatHappensNext } from "./WhatHappensNext";
import {
  formatIssuedDate,
  formatQuoteTotal,
  quoteMetrics,
  quoteMetricsFromAudit,
  quoteTotalLabel,
  termsLines,
  uploadedQuoteWhyThisPaysCopy,
  whyThisPaysCopy,
} from "./quotationViewModel";
import { useActiveQuotation } from "./useQuotation";

/** Line items shown before "Show all" — enough to see the major equipment. */
const COLLAPSED_LINE_COUNT = 6;

function DownloadIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M12 4v10M8 10l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 18h14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function QuotationPage() {
  const designSession = useDesignStore((state) => state.designSession);
  const activeBuild = getActiveBuild(designSession);
  const {
    data: quote,
    isLoading,
    error,
    mode,
    activeQuote,
  } = useActiveQuotation();
  const [showAllLines, setShowAllLines] = useState(false);

  if (!designSession) {
    return <Navigate to={ROUTE_PATHS.compare} replace />;
  }

  if (mode === "build" && !activeBuild) {
    return <Navigate to={ROUTE_PATHS.compare} replace />;
  }

  if (mode === "quote" && !activeQuote) {
    return <Navigate to={ROUTE_PATHS.compare} replace />;
  }

  const printQuote = () => {
    window.print();
  };

  const metrics =
    mode === "quote" && activeQuote
      ? quoteMetricsFromAudit(activeQuote)
      : activeBuild
        ? quoteMetrics(activeBuild)
        : [];
  const whyThisPays =
    mode === "quote" && activeQuote
      ? uploadedQuoteWhyThisPaysCopy(activeQuote)
      : activeBuild
        ? whyThisPaysCopy(activeBuild)
        : "";

  return (
    <div className="flex min-h-svh flex-col bg-paper">
      <main
        id="main"
        className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-6 pt-8 pb-44 lg:gap-8 lg:px-16 lg:pb-16"
      >
        <div className="flex overflow-x-auto sm:justify-center print:hidden">
          <DesignFlowStepper activeStep={5} />
        </div>

        <StepPageHeader
          className="print:hidden"
          backHref={ROUTE_PATHS.design}
          backLabel="Back to your design"
          eyebrow="Step 5 of 6 · Quotation"
          title={
            <>
              Here&apos;s what it <em className="font-normal italic">costs.</em>
            </>
          }
          lead={
            mode === "quote"
              ? "Your uploaded installer quote, read back line by line."
              : "Priced from your chosen build and benchmarked against 3 local vendors."
          }
          actions={
            // The mobile bar at the foot of the page carries these below lg.
            <div className="hidden gap-2 lg:flex">
              <Button
                variant="ghost"
                onClick={printQuote}
                className="h-12 gap-2 border-hairline bg-white px-5 text-ink"
              >
                <DownloadIcon />
                Download PDF
              </Button>
              <ButtonLink to={ROUTE_PATHS.brief} className="h-12 px-6">
                Start saving with solar
                <CtaArrow />
              </ButtonLink>
            </div>
          }
        />

        {mode === "build" ? <QuotationBuildPicker /> : null}

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
          <article className="quotation-document">
            {/* The letterhead belongs to the printed document; on screen the
                page header above already says whose quote this is. */}
            <header className="hidden flex-wrap items-start justify-between gap-4 border-b border-hairline pb-5 print:flex">
              <div>
                <p className="font-serif text-2xl font-medium text-ink">
                  Kahayag
                </p>
                <p className="mt-1 font-sans text-[12px] leading-5 text-secondary">
                  Lapu-Lapu City, Cebu
                  <br />
                  hello@kahayag.energy · +63 917 000 0000
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {mode === "quote" ? (
                  <span className="rounded-pill bg-cobalt-wash px-3 py-1 font-sans text-[11px] font-semibold text-cobalt">
                    Uploaded installer quote
                  </span>
                ) : (
                  <span className="rounded-pill bg-cobalt-wash px-3 py-1 font-sans text-[11px] font-semibold text-cobalt">
                    AI-benchmarked against 3 local vendors
                  </span>
                )}
              </div>
            </header>

            <div className="print:mt-5">
              <Eyebrow>Quotation</Eyebrow>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h2 className="font-serif text-[30px] leading-none font-medium text-ink lg:text-[34px]">
                  #{quote?.quote_number ?? "Draft quote"}
                </h2>
                {quote?.is_draft ? (
                  <span className="rounded-pill border border-hairline px-2.5 py-0.5 font-sans text-[10px] font-semibold tracking-wide text-secondary uppercase">
                    Draft
                  </span>
                ) : null}
              </div>
              {quote ? (
                <p className="mt-2 font-sans text-[11px] font-semibold tracking-[1.1px] text-tertiary-ink uppercase">
                  Issued {formatIssuedDate(quote.quote_date)} · Valid{" "}
                  {quote.validity_days} days
                </p>
              ) : null}
            </div>

            <section
              aria-label="Quote summary metrics"
              className="mt-6 grid grid-cols-2 gap-y-4 border-y border-hairline py-4 lg:grid-cols-4"
            >
              {metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="border-hairline pr-4 lg:border-l lg:pl-4 lg:first:border-l-0 lg:first:pl-0"
                >
                  <Eyebrow className="text-[10px] tracking-[1px]">
                    {metric.label}
                  </Eyebrow>
                  <p className="mt-1 font-serif text-[22px] leading-none font-medium text-ink lg:text-[24px]">
                    {metric.value}
                  </p>
                  <p className="mt-1 font-sans text-[11px] text-secondary">
                    {metric.detail}
                  </p>
                </div>
              ))}
            </section>

            {isLoading ? (
              <p className="mt-6 font-sans text-sm text-secondary">
                Loading quotation…
              </p>
            ) : null}

            {error ? (
              <p className="mt-6 font-sans text-sm text-ember" role="alert">
                {error.message}
              </p>
            ) : null}

            {quote ? (
              <>
                <section aria-label="Line items" className="mt-6">
                  <div className="flex items-baseline justify-between gap-3 border-b border-hairline pb-2">
                    <Eyebrow>
                      What you&apos;re getting · {quote.lines.length} items
                    </Eyebrow>
                    <Eyebrow>Amount</Eyebrow>
                  </div>
                  <ul className="divide-y divide-hairline border-b border-hairline">
                    {quote.lines.map((line, index) => (
                      <li
                        key={`${line.item}-${index}`}
                        // Collapsed rows still print: the PDF is the full
                        // contractual document.
                        className={cn(
                          "flex items-start justify-between gap-6 py-3",
                          !showAllLines &&
                            index >= COLLAPSED_LINE_COUNT &&
                            "hidden print:flex",
                        )}
                      >
                        <div className="min-w-0">
                          <p className="font-sans text-sm font-medium text-ink">
                            {line.item}
                          </p>
                          <p className="mt-0.5 font-sans text-[13px] leading-5 text-tertiary-ink">
                            {line.description} · {line.qty} {line.uom}
                          </p>
                        </div>
                        <p className="shrink-0 font-sans text-sm text-ink tabular-nums">
                          {peso(line.amount_php)}
                        </p>
                      </li>
                    ))}
                  </ul>
                  {quote.lines.length > COLLAPSED_LINE_COUNT ? (
                    <button
                      type="button"
                      aria-expanded={showAllLines}
                      onClick={() => setShowAllLines((current) => !current)}
                      className="mt-3 font-sans text-[13px] font-semibold text-cobalt hover:underline print:hidden"
                    >
                      {showAllLines
                        ? "Show fewer items"
                        : `Show all ${quote.lines.length} items`}
                    </button>
                  ) : null}
                </section>

                <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="flex flex-col gap-5">
                    {/* Terms come from the quotation document the backend
                        composed — the page never authors contractual copy. */}
                    <section aria-label="Payment terms">
                      <Eyebrow>Payment terms</Eyebrow>
                      <ul className="mt-2 flex flex-col gap-2">
                        {termsLines(quote.payment_terms).map((line) => (
                          <li
                            key={line}
                            className="flex gap-2 font-sans text-[13px] leading-5 text-secondary"
                          >
                            <span className="mt-1.5 size-1.5 shrink-0 rounded-pill bg-sun" />
                            {line}
                          </li>
                        ))}
                      </ul>
                    </section>
                    <section aria-label="Warranty">
                      <Eyebrow>Warranties</Eyebrow>
                      <ul className="mt-2 flex flex-col gap-2">
                        {termsLines(quote.warranty_summary).map((line) => (
                          <li
                            key={line}
                            className="flex gap-2 font-sans text-[13px] leading-5 text-secondary"
                          >
                            <span className="mt-1.5 size-1.5 shrink-0 rounded-pill bg-sun" />
                            {line}
                          </li>
                        ))}
                      </ul>
                    </section>
                  </div>

                  <div className="flex flex-col">
                    <div className="flex items-center justify-between gap-3 font-sans text-sm text-secondary">
                      <span>Subtotal</span>
                      <span>{peso(quote.subtotal_php)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 font-sans text-sm text-secondary">
                      <span>VAT (12%)</span>
                      <span>{peso(quote.vat_php)}</span>
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-3 border-t border-hairline pt-3">
                      <span className="font-sans text-sm font-semibold text-ink">
                        {quoteTotalLabel(quote)}
                      </span>
                      <span className="text-right font-serif text-[28px] leading-tight font-medium text-ink">
                        {formatQuoteTotal(quote)}
                      </span>
                    </div>
                  </div>
                </div>

                <aside className="mt-8 border-l-2 border-cobalt pl-3">
                  <Eyebrow tone="cobalt">Why this pays</Eyebrow>
                  <p className="mt-1 font-sans text-sm leading-6 text-ink">
                    {whyThisPays}
                  </p>
                </aside>
              </>
            ) : null}
          </article>

          <aside className="flex flex-col gap-8 border-t border-hairline pt-6 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-8 print:hidden">
            <AskEngineSidebar
              mode={mode}
              activeBuild={activeBuild}
              activeQuote={activeQuote}
            />
            <WhatHappensNext />
          </aside>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-hairline bg-paper px-4 pt-3 pb-4 lg:hidden print:hidden">
        <div className="mx-auto flex max-w-md flex-col gap-2">
          <ButtonLink to={ROUTE_PATHS.brief} fullWidth>
            Start saving with solar
            <CtaArrow />
          </ButtonLink>
          <Button
            variant="ghost"
            fullWidth
            onClick={printQuote}
            className="h-12 gap-2 border-hairline bg-white text-ink"
          >
            <DownloadIcon />
            Download PDF
          </Button>
        </div>
      </div>
    </div>
  );
}
