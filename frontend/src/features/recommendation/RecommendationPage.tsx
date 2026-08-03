import { useMemo, useState } from "react";
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
  buildInvestmentSliderBounds,
  clampInvestmentInputs,
  computeInvestmentProjection,
  formatBreakEvenYear,
  formatCompactPeso,
  formatInsightText,
  formatPeso,
  formatTimelinePeso,
} from "./investmentProjection";

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

  const projection = useMemo(() => {
    if (!baseline) {
      return null;
    }
    return computeInvestmentProjection({
      ...baseline,
      electricityRatePhpPerKwh: rate,
      systemCostPhp: cost,
      monthlyUsageKwh: usage,
    });
  }, [baseline, cost, rate, usage]);

  if (!result || !defaults || !bounds || !baseline || !projection) {
    return <Navigate to={ROUTE_PATHS.energy} replace />;
  }

  const isDefault =
    rate === baseline.electricityRatePhpPerKwh &&
    cost === baseline.systemCostPhp &&
    usage === baseline.monthlyUsageKwh;

  const reset = () => {
    setRate(baseline.electricityRatePhpPerKwh);
    setCost(baseline.systemCostPhp);
    setUsage(baseline.monthlyUsageKwh);
  };

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
            onChange={setRate}
            formatValue={(value) => `₱${value.toFixed(2)} / kWh`}
          />
          <Slider
            label="System cost"
            min={bounds.costMin}
            max={bounds.costMax}
            step={bounds.costStep}
            value={cost}
            onChange={setCost}
            formatValue={formatPeso}
          />
          <Slider
            label="Monthly use"
            min={bounds.usageMin}
            max={bounds.usageMax}
            step={bounds.usageStep}
            value={usage}
            onChange={setUsage}
            formatValue={(value) => `${value.toLocaleString("en-PH")} kWh`}
          />
        </section>
      }
      cta={<ButtonLink to={ROUTE_PATHS.why} fullWidth>Why this estimate?</ButtonLink>}
    >
      <section className="flex w-full flex-col gap-4" aria-label="Investment projection">
        <p className="font-serif text-[64px] leading-none font-medium text-ink lg:text-[76px]">
          {formatCompactPeso(projection.year25Net)}
        </p>
        <div className="flex h-28 w-full items-end gap-2.5 pt-6 pb-3" aria-hidden="true">
          {projection.growthBars.map((bar) => (
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
          <HairlineRow label="System cost" value={formatPeso(cost)} />
          <HairlineRow
            label="Monthly savings"
            value={formatPeso(projection.monthlySavingsPhp)}
          />
          <HairlineRow
            label="Annual savings"
            value={formatPeso(projection.annualSavingsPhp)}
          />
          <HairlineRow
            label="CO₂ avoided"
            value={`${projection.co2TonnesPerYear} t per year`}
            valueClassName="text-cobalt"
          />
        </HairlineList>
        <section aria-label="Payback timeline" className="flex w-full flex-col">
          <HairlineRow label="Year 0 · Installation" value={`−${formatPeso(cost).slice(1)}`} />
          <HairlineRow
            label="Break-even"
            value={formatBreakEvenYear(projection.breakEvenYear)}
            valueClassName="text-cobalt"
          />
          <HairlineRow label="Year 10 · Positive return" value={formatTimelinePeso(projection.year10Net)} />
          <HairlineRow label="Year 25 · Warranty end" value={formatTimelinePeso(projection.year25Net)} />
        </section>
        <p className="font-serif text-xl italic text-secondary">
          {formatInsightText(projection.breakEvenYear)}
        </p>
        <p className="font-sans text-sm text-secondary">
          0% electricity escalation
        </p>
        <p className="font-sans text-sm text-secondary">
          0.5% annual panel degradation
        </p>
      </section>
    </ContentScreen>
  );
}
