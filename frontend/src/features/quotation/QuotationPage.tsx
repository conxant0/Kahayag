import { Navigate } from "react-router-dom";

import { ROUTE_PATHS } from "../../app/routePaths";
import { ContentScreen } from "../../shared/components/layout";
import { DesignFlowStepper } from "../../shared/components/layout/DesignFlowStepper";
import {
  Button,
  ButtonLink,
  Eyebrow,
  HairlineList,
  HairlineRow,
} from "../../shared/components/ui";
import { peso } from "../../shared/lib/currency";
import { getActiveBuild } from "../design/designViewModel";
import { useDesignStore } from "../../state/designStore";
import { AskEngineSidebar } from "./AskEngineSidebar";
import {
  PAYMENT_TERMS,
  quoteValidUntil,
  whyThisPaysRows,
} from "./quotationViewModel";
import { useQuotation } from "./useQuotation";

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

  return (
    <ContentScreen
      eyebrow="Quotation"
      title={
        <>
          Your <em className="font-normal italic">itemized quote.</em>
        </>
      }
      backHref={ROUTE_PATHS.compare}
      backLabel="Back to compare"
      ctaSticky="always"
      cta={
        <div className="flex flex-col gap-2 print:hidden">
          <Button fullWidth onClick={printQuote}>
            Save as PDF
          </Button>
          <ButtonLink to={ROUTE_PATHS.brief} variant="secondary" fullWidth>
            Continue to project brief
          </ButtonLink>
        </div>
      }
      aside={<AskEngineSidebar />}
    >
      <DesignFlowStepper activeStep={5} />

      <div className="quotation-document flex flex-col gap-6">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline pb-4">
          <div>
            <p className="font-sans text-sm text-secondary">Kahayag Energy</p>
            <p className="font-serif text-2xl text-ink">
              {quote?.quote_number ?? "Draft quote"}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {quote?.is_draft ? (
              <span className="rounded-pill border border-hairline bg-white px-3 py-1 font-sans text-[11px] font-semibold tracking-wide text-secondary uppercase">
                Draft
              </span>
            ) : null}
            {quote ? (
              <p className="font-sans text-sm text-secondary">
                Valid {quote.validity_days} days · until{" "}
                {quoteValidUntil(quote.quote_date, quote.validity_days)}
              </p>
            ) : null}
          </div>
        </header>

        {isLoading ? (
          <p className="font-sans text-sm text-secondary">Loading quotation…</p>
        ) : null}

        {error ? (
          <p className="font-sans text-sm text-red-700" role="alert">
            {error.message}
          </p>
        ) : null}

        {quote ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] border-collapse font-sans text-sm">
                <thead>
                  <tr className="border-b border-hairline text-left text-[11px] font-semibold tracking-wide text-cobalt uppercase">
                    <th className="py-2 pr-3">Item</th>
                    <th className="py-2 pr-3">Description</th>
                    <th className="py-2 pr-3">Brand</th>
                    <th className="py-2 pr-3">UOM</th>
                    <th className="py-2 pr-3 text-right">Qty</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.lines.map((line, index) => (
                    <tr key={`${line.item}-${index}`} className="border-b border-hairline">
                      <td className="py-2 pr-3 text-ink">{line.item}</td>
                      <td className="py-2 pr-3 text-secondary">{line.description}</td>
                      <td className="py-2 pr-3 text-secondary">{line.brand}</td>
                      <td className="py-2 pr-3 text-secondary">{line.uom}</td>
                      <td className="py-2 pr-3 text-right text-ink">{line.qty}</td>
                      <td className="py-2 text-right text-ink">
                        {peso(line.amount_php)}
                        {line.price_as_of ? (
                          <span className="block text-xs text-tertiary-ink">
                            as of {line.price_as_of}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ml-auto w-full max-w-sm">
              <HairlineList>
                <HairlineRow label="Subtotal" value={peso(quote.subtotal_php)} />
                <HairlineRow label="VAT (12%)" value={peso(quote.vat_php)} />
                <HairlineRow
                  label="Total investment"
                  value={peso(quote.total_php)}
                  valueClassName="font-semibold text-ink"
                />
              </HairlineList>
            </div>

            <section aria-label="Why this pays">
              <Eyebrow tone="cobalt">Why this pays</Eyebrow>
              <HairlineList className="mt-2">
                {whyThisPaysRows(activeBuild).map((row) => (
                  <HairlineRow key={row.label} label={row.label} value={row.value} />
                ))}
              </HairlineList>
            </section>

            <section aria-label="What happens next">
              <Eyebrow tone="cobalt">What happens next</Eyebrow>
              <ol className="mt-2 list-decimal pl-5 font-sans text-sm text-secondary">
                <li>Review this draft quote with your household.</li>
                <li>Request a site survey from a licensed installer.</li>
                <li>Confirm net-metering paperwork and utility interconnection.</li>
                <li>Schedule installation after contract signing.</li>
              </ol>
            </section>

            <section aria-label="Payment terms">
              <Eyebrow tone="cobalt">Payment terms</Eyebrow>
              <p className="mt-2 font-sans text-sm text-secondary">
                {quote.payment_terms ?? PAYMENT_TERMS}
              </p>
            </section>

            <section aria-label="Warranty">
              <Eyebrow tone="cobalt">Warranty</Eyebrow>
              <p className="mt-2 font-sans text-sm text-secondary">
                {quote.warranty_summary}
              </p>
            </section>
          </>
        ) : null}
      </div>
    </ContentScreen>
  );
}
