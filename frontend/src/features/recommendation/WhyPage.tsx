import { useMemo } from "react";
import { Navigate } from "react-router-dom";

import { ROUTE_PATHS } from "../../app/routePaths";
import { ContentScreen } from "../../shared/components/layout";
import { Rule } from "../../shared/components/ui";
import { useAssessmentStore } from "../../state/assessmentStore";
import { readAssessmentResult } from "../assessment/formatAssessmentResult";
import {
  buildPredictionConfidence,
  formatConfidenceHeading,
} from "./predictionConfidence";

export function WhyPage() {
  const rawResult = useAssessmentStore((state) => state.result);
  const roofPolygon = useAssessmentStore((state) => state.roofPolygon);
  const energyInputs = useAssessmentStore((state) => state.energyInputs);
  const result = readAssessmentResult(rawResult);
  const confidence = useMemo(
    () =>
      result
        ? buildPredictionConfidence({ result, roofPolygon, energyInputs })
        : null,
    [energyInputs, result, roofPolygon],
  );

  if (!result || !confidence) {
    // Memory-only result: recompute via /loading rather than dropping the
    // visitor on the bill screen after a refresh.
    return <Navigate to={ROUTE_PATHS.loading} replace />;
  }

  // Deliberately no CTA: this page explains the estimate and hands the
  // visitor back to the investment view. The brief is reached through the
  // quotation flow, not from here.
  return (
    <ContentScreen
      eyebrow="The prediction engine"
      backHref={ROUTE_PATHS.invest}
      backLabel="Back to your investment"
      title={
        <>
          Why <span className="text-cobalt">{formatConfidenceHeading(confidence.overallPercent)}</span>?
        </>
      }
    >
      <p className="font-sans text-[17px] text-secondary lg:text-[18px]">
        {confidence.intro}
      </p>

      <section className="flex w-full flex-col pt-3" aria-label="Confidence by input">
        {confidence.factors.map((factor) => (
          <div key={factor.name} className="flex flex-col">
            <Rule />
            <div className="flex items-center gap-4 py-4">
              <div className="flex min-w-0 flex-1 flex-col gap-0.75">
                <p className="font-sans text-[16px] font-semibold text-ink">
                  {factor.name}
                </p>
                <p className="font-sans text-[14px] text-tertiary-ink">
                  {factor.source}
                </p>
              </div>
              <p
                className={`shrink-0 font-sans text-[16px] font-semibold ${factor.high ? "text-cobalt" : "text-tertiary-ink"}`}
              >
                {factor.confidence}
              </p>
            </div>
          </div>
        ))}
      </section>

      <details className="group w-full pt-2">
        <Rule />
        <summary className="flex cursor-pointer list-none items-center gap-3 py-5 marker:hidden">
          <span className="flex min-w-0 flex-1 flex-col gap-0.75">
            <span className="font-sans text-[16px] font-semibold text-ink">
              Advanced analysis
            </span>
            <span className="font-sans text-[14px] text-tertiary-ink">
              Irradiance curves, degradation model, available shading data
            </span>
          </span>
          <span aria-hidden="true" className="shrink-0 text-tertiary-ink">
            ⌄
          </span>
        </summary>
        <p className="pb-5 font-sans text-[14px] text-secondary">
          {confidence.advancedAnalysis}
        </p>
        <Rule />
      </details>
    </ContentScreen>
  );
}
