import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";

import { ROUTE_PATHS } from "../../app/routePaths";
import { ContentScreen } from "../../shared/components/layout";
import {
  Button,
  ButtonLink,
  CtaArrow,
  KahayagSunrise,
  Rule,
} from "../../shared/components/ui";
import { useAssessmentStore } from "../../state/assessmentStore";
import { readAssessmentResult } from "../assessment/formatAssessmentResult";
import { buildReportPreview } from "./projectBrief";
import { buildReportRequest } from "./buildReportRequest";
import { useDownloadReport } from "./hooks/useDownloadReport";

/**
 * /report — Figma 2172:280 (D3 / Download Report).
 *
 * The contents card lists what the PDF actually holds, so nothing about the
 * download is a surprise. Cobalt ticks: the engine confirming what it produced.
 */
export function ReportPage() {
  const rawResult = useAssessmentStore((state) => state.result);
  const selectedProperty = useAssessmentStore(
    (state) => state.selectedProperty,
  );
  const roofPolygon = useAssessmentStore((state) => state.roofPolygon);
  const energyInputs = useAssessmentStore((state) => state.energyInputs);
  const result = readAssessmentResult(rawResult);

  const [downloadError, setDownloadError] = useState<string | null>(null);
  const { mutateAsync: downloadReport, isPending } = useDownloadReport();

  const report = useMemo(
    () =>
      buildReportPreview({
        result,
        selectedProperty,
        roofPolygon,
        energyInputs,
      }),
    [energyInputs, result, roofPolygon, selectedProperty],
  );

  // `buildReportRequest` throws when the trace cannot hold the recommended
  // panels, so it runs inside the same try as the request: from here both are
  // the same failure — no PDF — and both belong in the same message.
  const handleDownload = async () => {
    setDownloadError(null);
    try {
      await downloadReport(buildReportRequest({ result, roofPolygon }));
    } catch (error) {
      setDownloadError(
        error instanceof Error
          ? error.message
          : "Could not prepare the report. Try again.",
      );
    }
  };

  if (!result) {
    return <Navigate to={ROUTE_PATHS.energy} replace />;
  }

  const hasRoofTrace = (roofPolygon?.coordinates.length ?? 0) >= 3;

  return (
    <ContentScreen
      eyebrow="Your report"
      className="lg:w-153.75 lg:gap-6.75 lg:px-9 lg:pt-6 lg:pb-15"
      backHref={ROUTE_PATHS.brief}
      backLabel="Back to project brief"
      title="Everything, in one PDF."
      cta={
        <>
          <Button
            onClick={handleDownload}
            disabled={isPending || !hasRoofTrace}
            fullWidth
            className="lg:h-16 lg:text-[18px]"
          >
            {isPending ? "Preparing PDF…" : "Download PDF report"}
            <CtaArrow />
          </Button>

          {/* A disabled action with no reason beside it reads as a broken
              button. The PDF draws the panel layout, so it needs the trace. */}
          <p className="w-full text-center font-sans text-[14px] font-medium text-tertiary-ink lg:pt-0.75 lg:text-[15px]">
            {hasRoofTrace
              ? report.footerCaption
              : "The report draws your panel layout, so it needs your roof trace."}
          </p>

          {/* The journey continues to the permit check; the report is no longer
              the final step. */}
          <ButtonLink
            to={ROUTE_PATHS.permits}
            fullWidth
            className="lg:h-16 lg:text-[18px]"
          >
            Check permit requirements
            <CtaArrow />
          </ButtonLink>

          {/* Ember interrupts — the one place on this screen that does. */}
          {downloadError ? (
            <p
              role="alert"
              className="w-full text-center font-sans text-sm text-ember"
            >
              {downloadError}
            </p>
          ) : null}
        </>
      }
    >
      <article className="flex w-full flex-col gap-4 rounded-3xl border-[1.5px] border-hairline bg-white px-6 py-7 lg:gap-5.25 lg:px-7.5 lg:py-8.25">
        <KahayagSunrise size={48} />

        <h2 className="font-serif text-[26px] font-medium text-ink">
          {report.title}
        </h2>

        <p className="font-sans text-[15px] text-tertiary-ink">
          {report.metaLine}
        </p>

        <ul className="flex list-none flex-col gap-4 p-0 lg:gap-5.25">
          {report.contents.map((item) => (
            <li key={item} className="flex flex-col gap-4 lg:gap-5.25">
              <Rule className="lg:h-px" />
              <span className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="font-sans font-semibold text-cobalt lg:text-[15px]"
                >
                  ✓
                </span>
                <span className="font-sans text-[16px] text-secondary lg:text-[17px]">
                  {item}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </article>

      <div className="hidden min-h-0 flex-1 lg:block" />
    </ContentScreen>
  );
}
