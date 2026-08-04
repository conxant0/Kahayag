import { useMemo } from "react";
import { Navigate } from "react-router-dom";

import { FlowLayout } from "../../shared/components/layout";
import { Chip, Eyebrow, Rule, UploadCard } from "../../shared/components/ui";
import { ROUTE_PATHS } from "../../app/routePaths";
import { peso } from "../../shared/lib/currency";
import { useAssessmentStore } from "../../state/assessmentStore";
import {
  computeLiveEstimate,
  formatLiveEstimatePayback,
  formatLiveEstimateSystemSize,
  resolveRoofAreaSquareMeters,
} from "./liveEstimate";
import { resolveRedirectForStep } from "./sessionGuard";
import { RefineInputs } from "./components/RefineInputs";

/**
 * /energy — Figma 2171:53 (desktop) and 2133:19 (mobile).
 *
 * The bill is the one number the homeowner already knows, so it is the largest
 * thing on the screen and it is theirs to type. It starts empty: pre-filling
 * ₱4,800 would be the product asserting a figure it has not been told.
 *
 * The quick picks fill the same field rather than replacing it, and the live
 * estimate stays blank until there is a number to estimate from.
 *
 * A budget and the tariff both change the answer, so both are offered — behind
 * a disclosure, because giving them equal weight with the bill would make the
 * question most people can answer look like one of three they cannot.
 */
const PRESETS = [2500, 4800, 8000, 12000];

/** Digits only — the peso sign and separators are presentation, not input. */
const digitsOf = (value: string) => value.replace(/\D/g, "");

export function AssessmentPage() {
  const selectedProperty = useAssessmentStore(
    (state) => state.selectedProperty,
  );
  const roofPolygon = useAssessmentStore((state) => state.roofPolygon);
  const energyInputs = useAssessmentStore((state) => state.energyInputs);
  const setEnergyInputs = useAssessmentStore((state) => state.setEnergyInputs);

  const redirect = resolveRedirectForStep("energy", {
    selectedProperty,
    roofPolygon,
    energyInputs,
  });

  const billDigits =
    energyInputs.monthlyBillPhp != null
      ? String(Math.round(energyInputs.monthlyBillPhp))
      : "";
  const amount = Number(billDigits);
  const hasAmount = amount > 0;
  const fieldId = "monthly-electricity-bill";

  const liveEstimate = useMemo(() => {
    if (!hasAmount || roofPolygon == null) {
      return null;
    }

    return computeLiveEstimate({
      monthlyBillPhp: amount,
      electricityRatePhpPerKwh: energyInputs.electricityRatePhpPerKwh,
      roofAreaSquareMeters: resolveRoofAreaSquareMeters(roofPolygon),
      budgetPhp: energyInputs.budgetPhp,
    });
  }, [amount, energyInputs, hasAmount, roofPolygon]);

  const systemKwp = formatLiveEstimateSystemSize(
    liveEstimate?.systemCapacityKwp ?? null,
  );
  const paybackYears = formatLiveEstimatePayback(
    liveEstimate?.paybackYears ?? null,
  );

  const updateBill = (nextDigits: string) => {
    const nextAmount = Number(nextDigits);
    setEnergyInputs({
      monthlyBillPhp: nextDigits ? nextAmount : null,
    });
  };

  const formattedAmount = hasAmount ? amount.toLocaleString("en-PH") : "";

  // After the hooks, so the order stays stable between a session that may stay
  // and one that is on its way back to an earlier step.
  if (redirect) {
    return <Navigate to={redirect} replace />;
  }

  return (
    <FlowLayout
      step="Step 3 of 4"
      title="What do you pay monthly?"
      backHref={ROUTE_PATHS.trace}
      backLabel="Back to roof trace"
      nextHref={ROUTE_PATHS.loading}
      nextLabel="See my results"
      nextDisabled={!hasAmount}
      paneClassName="flex items-center justify-center"
      pane={
        <div className="flex w-full flex-col items-center gap-2.5 lg:gap-6">
          <label htmlFor={fieldId} className="sr-only">
            Monthly electricity bill in pesos
          </label>

          <div className="flex w-full items-baseline justify-center font-serif text-[68px] leading-none font-medium text-ink tabular-nums lg:text-[120px]">
            <span
              aria-hidden="true"
              className={hasAmount ? "" : "text-tertiary-ink"}
            >
              ₱
            </span>
            <input
              id={fieldId}
              inputMode="numeric"
              autoComplete="off"
              value={formattedAmount}
              onChange={(event) => updateBill(digitsOf(event.target.value))}
              placeholder="0"
              className="min-w-0 border-none bg-transparent p-0 text-left font-serif leading-none font-medium text-ink tabular-nums outline-none placeholder:text-tertiary-ink focus-visible:outline-none"
              // The field grows with the number instead of reserving room for
              // one, so the amount stays optically centred under the heading.
              style={{
                width: `${Math.max((formattedAmount || "0").length, 1) * 0.62}em`,
              }}
            />
          </div>

          <div className="h-0.5 w-45 bg-sun lg:h-1 lg:w-75" />

          <p className="font-sans text-[13px] font-medium text-tertiary-ink lg:text-[15px]">
            monthly electricity bill
          </p>

          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {PRESETS.map((preset) => (
              <Chip
                key={preset}
                selected={amount === preset}
                onClick={() => updateBill(String(preset))}
              >
                {peso(preset)}
              </Chip>
            ))}
          </div>
        </div>
      }
    >
      <UploadCard
        title="Snap a photo of your bill"
        hint="We’ll read it and fill everything in · optional"
      />

      <RefineInputs
        budgetPhp={energyInputs.budgetPhp}
        electricityRatePhpPerKwh={energyInputs.electricityRatePhpPerKwh}
        onChange={setEnergyInputs}
      />

      <section
        className="flex w-full flex-col gap-2.5 pt-2"
        aria-label="Live estimate"
      >
        <Eyebrow>Live estimate</Eyebrow>
        <Rule />

        <dl className="flex items-start py-1">
          <div className="min-w-0 flex-1 pr-4">
            <dd className="font-sans text-xl font-semibold text-ink">
              {systemKwp} kWp
            </dd>
            <dt className="font-sans text-xs text-secondary">System size</dt>
          </div>

          <div className="min-w-0 flex-1 border-l border-hairline pl-4">
            <dd className="font-sans text-xl font-semibold text-ink">
              {paybackYears} yrs
            </dd>
            <dt className="font-sans text-xs text-secondary">Payback</dt>
          </div>
        </dl>
      </section>
    </FlowLayout>
  );
}
