import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";

import { ROUTE_PATHS } from "../../app/routePaths";
import { ContentScreen } from "../../shared/components/layout";
import {
  ButtonLink,
  HairlineList,
  HairlineRow,
  Slider,
} from "../../shared/components/ui";
import { useAssessmentStore } from "../../state/assessmentStore";
import { readAssessmentResult } from "../assessment/formatAssessmentResult";
import {
  buildInvestmentDefaults,
  buildGrowthBars,
  buildInvestmentProjectionPayload,
  buildInvestmentSliderBounds,
  clampInvestmentInputs,
  formatBreakEvenYear,
  formatCompactPeso,
  formatInsightText,
  formatPeso,
  formatTimelinePeso,
} from "./investmentProjection";
import { useInvestmentProjection } from "./useInvestmentProjection";
import type { InvestmentProjectionResponse } from "../../shared/api/types";

export function RecommendationPage() {
  const rawResult = useAssessmentStore((state) => state.result);
  const result = readAssessmentResult(rawResult);
  const defaults = useMemo(
    () => (result ? buildInvestmentDefaults(result) : null),
    [result],
  );
  const bounds = useMemo(
    () => (defaults ? buildInvestmentSliderBounds(defaults) : null),
    [defaults],
  );
  const baseline = useMemo(
    () => (defaults && bounds ? clampInvestmentInputs(defaults, bounds) : null),
    [bounds, defaults],
  );
  const [rate, setRate] = useState(
    () => baseline?.electricityRatePhpPerKwh ?? 0,
  );
  const [cost, setCost] = useState(() => baseline?.systemCostPhp ?? 0);
  const [usage, setUsage] = useState(() => baseline?.monthlyUsageKwh ?? 0);
  const { mutateAsync, isPending } = useInvestmentProjection();
  const requestId = useRef(0);
  const [projection, setProjection] =
    useState<InvestmentProjectionResponse | null>(null);
  const [projectionError, setProjectionError] = useState<string | null>(null);

  useEffect(() => {
    if (!result || !baseline) return;
    const currentRequestId = ++requestId.current;
    const timer = window.setTimeout(() => {
      void mutateAsync(
        buildInvestmentProjectionPayload(result, {
          electricityRatePhpPerKwh: rate,
          systemCostPhp: cost,
          monthlyUsageKwh: usage,
        }),
      )
        .then((response) => {
          if (currentRequestId === requestId.current) {
            setProjection(response);
            setProjectionError(null);
          }
        })
        .catch((error: unknown) => {
          if (currentRequestId === requestId.current) {
            setProjectionError(
              error instanceof Error
                ? error.message
                : "Could not update the projection.",
            );
          }
        });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [baseline, cost, mutateAsync, rate, result, usage]);

  if (!result || !defaults || !bounds || !baseline) {
    // The result lives in memory only, so a refresh or direct visit lands
    // here without one. /loading recomputes it from the persisted inputs
    // (and its own guard walks further back if those are missing) — far
    // better than silently dumping the visitor on the bill screen.
    return <Navigate to={ROUTE_PATHS.loading} replace />;
  }

  const isDefault =
    rate === baseline.electricityRatePhpPerKwh &&
    cost === baseline.systemCostPhp &&
    usage === baseline.monthlyUsageKwh;

  const reset = () => {
    requestId.current += 1;
    setProjection(null);
    setProjectionError(null);
    setRate(baseline.electricityRatePhpPerKwh);
    setCost(baseline.systemCostPhp);
    setUsage(baseline.monthlyUsageKwh);
  };
  const growthBars = projection ? buildGrowthBars(projection.milestones) : [];
  const breakEvenYear = projection?.break_even_year
    ? Number(projection.break_even_year)
    : null;

  return (
    <ContentScreen
      eyebrow="The 25-year picture"
      title="Your solar investment."
      backHref={ROUTE_PATHS.results}
      backLabel="Back to your results"
      ctaSticky="always"
      aside={
        <section className="flex w-full flex-col gap-5" aria-label="Adjust assumptions">
          <div className="flex w-full items-start gap-4">
            <h2 className="min-w-0 flex-1 font-sans text-[13px] font-semibold tracking-[1.8px] text-cobalt uppercase">
              Adjust assumptions
            </h2>
            <button
              type="button"
              onClick={reset}
              disabled={isDefault}
              className="shrink-0 font-sans text-[15px] font-semibold text-cobalt hover:underline disabled:opacity-45"
            >
              Reset
            </button>
          </div>
          <Slider
            label="Electricity rate"
            min={bounds.rateMin}
            max={bounds.rateMax}
            step={bounds.rateStep}
            value={rate}
            onChange={(value) => {
              requestId.current += 1;
              setProjection(null);
              setProjectionError(null);
              setRate(value);
            }}
            formatValue={(value) => `₱${value.toFixed(2)} / kWh`}
          />
          <Slider
            label="System cost"
            min={bounds.costMin}
            max={bounds.costMax}
            step={bounds.costStep}
            value={cost}
            onChange={(value) => {
              requestId.current += 1;
              setProjection(null);
              setProjectionError(null);
              setCost(value);
            }}
            formatValue={formatPeso}
          />
          <Slider
            label="Monthly use"
            min={bounds.usageMin}
            max={bounds.usageMax}
            step={bounds.usageStep}
            value={usage}
            onChange={(value) => {
              requestId.current += 1;
              setProjection(null);
              setProjectionError(null);
              setUsage(value);
            }}
            formatValue={(value) => `${value.toLocaleString("en-PH")} kWh`}
          />
        </section>
      }
      cta={<ButtonLink to={ROUTE_PATHS.why} fullWidth>Why this estimate?</ButtonLink>}
    >
      <section className="flex w-full flex-col gap-4" aria-label="Investment projection">
        {projection ? (
          <>
            <p className="font-serif text-[64px] leading-none font-medium text-ink lg:text-[76px]">
              {formatCompactPeso(projection.year_25_net_php)}
            </p>
            <div className="flex h-28 w-full items-end gap-2.5 pt-6 pb-3" aria-hidden="true">
              {growthBars.map((bar) => (
                <span
                  key={bar.year}
                  className="min-w-0 flex-1 rounded-[4.65px] bg-sun"
                  style={{ height: `${bar.heightPct}%` }}
                />
              ))}
            </div>
            <p className="font-sans text-[15px] text-tertiary-ink">
              total savings by year 25 · today&apos;s pesos
            </p>
            <HairlineList>
              <HairlineRow label="System cost" value={formatPeso(projection.system_cost_php)} />
              <HairlineRow label="Monthly savings" value={formatPeso(projection.monthly_savings_php)} />
              <HairlineRow label="Annual savings" value={formatPeso(projection.annual_savings_php)} />
              <HairlineRow
                label="CO₂ avoided"
                value={`${projection.co2_tonnes_per_year} t per year`}
                valueClassName="text-cobalt"
              />
            </HairlineList>
            <section aria-label="Payback timeline" className="flex w-full flex-col">
              <HairlineRow
                label="Year 0 · Installation"
                value={formatTimelinePeso(-projection.system_cost_php)}
              />
              <HairlineRow label="Break-even" value={formatBreakEvenYear(breakEvenYear)} valueClassName="text-cobalt" />
              <HairlineRow label="Year 10 · Positive return" value={formatTimelinePeso(projection.year_10_net_php)} />
              <HairlineRow label="Year 25 · Warranty end" value={formatTimelinePeso(projection.year_25_net_php)} />
            </section>
            <p className="font-serif text-xl italic text-secondary">
              {formatInsightText(breakEvenYear)}
            </p>
            <p className="font-sans text-sm text-secondary">
              {Number(projection.assumptions.electricity_escalation_ratio) * 100}% electricity escalation
            </p>
            <p className="font-sans text-sm text-secondary">
              {Number(projection.assumptions.annual_panel_degradation_ratio) * 100}% annual panel degradation
            </p>
          </>
        ) : projectionError ? null : (
          <p className="font-sans text-sm text-secondary" aria-busy={isPending}>
            Calculating projection…
          </p>
        )}
        {projectionError ? (
          <p role="alert" className="font-sans text-sm leading-6 text-ember">
            {projectionError}
          </p>
        ) : null}
      </section>
    </ContentScreen>
  );
}
