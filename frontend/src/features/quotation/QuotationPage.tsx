import { Navigate } from "react-router-dom";

import { ROUTE_PATHS } from "../../app/routePaths";
import { DesignFlowStepper } from "../../shared/components/layout/DesignFlowStepper";
import { Button, ButtonLink, Eyebrow } from "../../shared/components/ui";
import { peso } from "../../shared/lib/currency";
import { useDesignStore } from "../../state/designStore";
import { getActiveBuild } from "../design/designViewModel";
import { AskEngineSidebar } from "./AskEngineSidebar";
import { WhatHappensNext } from "./WhatHappensNext";
import {
  PAYMENT_TERMS_LINES,
  WARRANTY_LINES,
  formatIssuedDate,
  formatQuoteTotal,
  quoteMetrics,
  whyThisPaysCopy,
} from "./quotationViewModel";
import { useQuotation } from "./useQuotation";

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
  const { data: quote, isLoading, error } = useQuotation(activeBuild?.id ?? null);

  if (!designSession || !activeBuild) {
    return <Navigate to={ROUTE_PATHS.compare} replace />;
  }

  const printQuote = () => {
    window.print();
  };

  const metrics = quoteMetrics(activeBuild);

  return (
    <div className="flex min-h-svh flex-col bg-[#f4f1ea]">
      <main
        id="main"
        className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 pt-6 pb-28 lg:gap-8 lg:px-10 lg:pt-10 lg:pb-16"
      >
        <DesignFlowStepper activeStep={5} />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
          <article className="quotation-document rounded-[20px] border border-hairline bg-white p-5 shadow-[0_8px_24px_rgba(26,23,18,0.04)] lg:p-8">
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-hairline pb-5">
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
                <span className="rounded-pill bg-cobalt-wash px-3 py-1 font-sans text-[11px] font-semibold text-cobalt">
                  AI-benchmarked against 3 local vendors
                </span>
                {quote?.is_draft ? (
                  <span className="rounded-pill border border-hairline px-3 py-1 font-sans text-[11px] font-semibold tracking-wide text-secondary uppercase">
                    Draft
                  </span>
                ) : null}
              </div>
            </header>

            <div className="mt-5">
              <Eyebrow>Quotation</Eyebrow>
              <h1 className="mt-2 font-serif text-[34px] font-medium leading-none text-ink lg:text-[42px]">
                #{quote?.quote_number ?? "Draft quote"}
              </h1>
              {quote ? (
                <p className="mt-2 font-sans text-[11px] font-semibold tracking-[1.1px] text-tertiary uppercase">
                  Issued {formatIssuedDate(quote.quote_date)} · Valid{" "}
                  {quote.validity_days} days
                </p>
              ) : null}
            </div>

            <section
              aria-label="Quote summary metrics"
              className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4"
            >
              {metrics.map((metric) => (
                <div
                  key={metric.label}
                  className={
                    metric.highlighted
                      ? "rounded-[14px] bg-sun px-3 py-3"
                      : "rounded-[14px] border border-hairline bg-[#fcfaf5] px-3 py-3"
                  }
                >
                  <p className="font-sans text-[10px] font-semibold tracking-[0.8px] text-secondary uppercase">
                    {metric.label}
                  </p>
                  <p className="mt-1 font-serif text-[22px] font-medium leading-none text-ink lg:text-[24px]">
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
                <div className="mt-6 overflow-x-auto">
                  <table className="hidden w-full min-w-[40rem] border-collapse font-sans text-sm lg:table">
                    <thead>
                      <tr className="border-b border-hairline text-left text-[10px] font-semibold tracking-[1px] text-tertiary uppercase">
                        <th className="py-2 pr-2">Sr</th>
                        <th className="py-2 pr-3">What you&apos;re getting</th>
                        <th className="py-2 pr-3">Expert details</th>
                        <th className="py-2 pr-3">Brand</th>
                        <th className="py-2 pr-3">UOM</th>
                        <th className="py-2 pr-3 text-right">Qty</th>
                        <th className="py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quote.lines.map((line, index) => (
                        <tr
                          key={`${line.item}-${index}`}
                          className="border-b border-hairline"
                        >
                          <td className="py-3 pr-2 text-tertiary">
                            {String(index + 1).padStart(2, "0")}
                          </td>
                          <td className="py-3 pr-3 font-semibold text-ink">
                            {line.item}
                          </td>
                          <td className="py-3 pr-3 text-secondary">
                            {line.description}
                          </td>
                          <td className="py-3 pr-3 text-secondary">{line.brand}</td>
                          <td className="py-3 pr-3 text-secondary">{line.uom}</td>
                          <td className="py-3 pr-3 text-right text-ink">
                            {line.qty}
                          </td>
                          <td className="py-3 text-right text-ink">
                            {peso(line.amount_php)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="flex flex-col gap-4 lg:hidden">
                    <Eyebrow>Line items · {quote.lines.length}</Eyebrow>
                    {quote.lines.map((line, index) => (
                      <div
                        key={`${line.item}-${index}`}
                        className="border-b border-hairline pb-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-sans text-sm font-semibold text-ink">
                            <span className="mr-2 text-tertiary">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            {line.item}
                          </p>
                          <p className="font-sans text-sm font-semibold text-ink">
                            {peso(line.amount_php)}
                          </p>
                        </div>
                        <p className="mt-1 font-sans text-[13px] text-secondary">
                          {line.description}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-pill bg-[#f2eee4] px-2.5 py-1 font-sans text-[11px] text-secondary">
                            {line.brand}
                          </span>
                          <span className="rounded-pill bg-[#f2eee4] px-2.5 py-1 font-sans text-[11px] text-secondary">
                            {line.qty} {line.uom}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="flex flex-col gap-5">
                    <section aria-label="Payment terms">
                      <Eyebrow>Payment terms</Eyebrow>
                      <ul className="mt-2 flex flex-col gap-2">
                        {PAYMENT_TERMS_LINES.map((line) => (
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
                        {WARRANTY_LINES.map((line) => (
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
                        Estimated total range
                      </span>
                      <span className="text-right font-serif text-[28px] font-medium leading-tight text-ink">
                        {formatQuoteTotal(quote)}
                      </span>
                    </div>

                    <div className="mt-5 hidden flex-col gap-2 print:hidden lg:flex">
                      <ButtonLink to={ROUTE_PATHS.brief} fullWidth>
                        Start saving with solar
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

                <aside className="mt-6 rounded-[14px] border-l-4 border-cobalt bg-cobalt-wash px-4 py-3">
                  <p className="font-sans text-[10px] font-semibold tracking-[1px] text-cobalt uppercase">
                    Why this pays
                  </p>
                  <p className="mt-1 font-serif text-[15px] leading-6 text-ink italic">
                    {whyThisPaysCopy(activeBuild)}
                  </p>
                </aside>
              </>
            ) : null}
          </article>

          <aside className="flex flex-col gap-4">
            <AskEngineSidebar />
            <WhatHappensNext />
          </aside>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-hairline bg-paper px-4 pt-3 pb-4 print:hidden lg:hidden">
        <div className="mx-auto flex max-w-md flex-col gap-2">
          <ButtonLink to={ROUTE_PATHS.brief} fullWidth>
            Start saving with solar
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
