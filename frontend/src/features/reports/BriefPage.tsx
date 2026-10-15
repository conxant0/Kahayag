import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";

import { ROUTE_PATHS } from "../../app/routePaths";
import {
  DesignFlowStepper,
  StepPageHeader,
} from "../../shared/components/layout";
import {
  ButtonLink,
  Chip,
  CtaArrow,
  Eyebrow,
  HairlineList,
  HairlineRow,
} from "../../shared/components/ui";
import { useAssessmentStore } from "../../state/assessmentStore";
import { useDesignStore } from "../../state/designStore";
import { readAssessmentResult } from "../assessment/formatAssessmentResult";
import { getActiveBuild } from "../design/designViewModel";
import { useQuotation } from "../quotation/useQuotation";
import {
  buildDesignFinancialRows,
  buildDesignRows,
  buildProjectBrief,
  buildQuotationRows,
  PANEL_CLASS_OPTIONS,
  shareProjectBrief,
  type BriefRow,
} from "./projectBrief";
import { BriefRoofPhoto } from "./components/BriefRoofPhoto";
import { BriefSystemDiagram } from "./components/BriefSystemDiagram";

/**
 * /brief — Figma 2172:222 (D3 / Project Brief).
 *
 * The page an installer gets handed. Cobalt marks the figures the engine stands
 * behind; the closing disclaimer is the brandbook's "never overclaim" rule, and
 * it stays above the CTA rather than below it.
 */

/** How long a share confirmation stays on screen before it clears itself. */
const SHARE_MESSAGE_MS = 3000;

function SpecSection({ title, rows }: { title: string; rows: BriefRow[] }) {
  return (
    <section className="flex w-full flex-col pt-2" aria-label={title}>
      <Eyebrow as="h2" className="pb-2">
        {title}
      </Eyebrow>

      <HairlineList>
        {rows.map((row) => (
          <HairlineRow
            key={row.label}
            size="md"
            label={row.label}
            value={row.value}
            valueClassName={row.cobalt ? "text-cobalt" : undefined}
            // Re-adds the rule the first row normally drops, so each section
            // opens under a line of its own rather than running into the label.
            className="first:border-t"
          />
        ))}
      </HairlineList>
    </section>
  );
}

export function BriefPage() {
  const rawResult = useAssessmentStore((state) => state.result);
  const selectedProperty = useAssessmentStore(
    (state) => state.selectedProperty,
  );
  const roofPolygon = useAssessmentStore((state) => state.roofPolygon);
  const energyInputs = useAssessmentStore((state) => state.energyInputs);
  const result = readAssessmentResult(rawResult);

  // The design and its quotation come along when the homeowner went through
  // the D3 flow. Both sections simply do not render for a visitor who
  // skipped it — the brief stands on the assessment alone.
  const designSession = useDesignStore((state) => state.designSession);
  const activeBuild = getActiveBuild(designSession);
  const { data: quote } = useQuotation(activeBuild?.id ?? null);

  // Null means "whatever the engine recommended". Holding the override rather
  // than a resolved id means the brief is built once per render instead of
  // twice, and no effect has to copy the default across when it changes.
  const [panelClassOverride, setPanelClassOverride] = useState<string | null>(
    null,
  );
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  const brief = useMemo(
    () =>
      buildProjectBrief({
        result,
        selectedProperty,
        roofPolygon,
        energyInputs,
        panelCategoryId: panelClassOverride ?? undefined,
      }),
    [energyInputs, panelClassOverride, result, roofPolygon, selectedProperty],
  );

  useEffect(() => {
    if (!shareMessage) {
      return undefined;
    }

    const timer = window.setTimeout(
      () => setShareMessage(null),
      SHARE_MESSAGE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [shareMessage]);

  const handleShare = async () => {
    try {
      const outcome = await shareProjectBrief(brief.shareText);

      if (outcome === "shared") {
        setShareMessage("Brief shared.");
        return;
      }

      if (outcome === "copied") {
        setShareMessage("Brief link copied.");
        return;
      }

      setShareMessage("Sharing is not supported in this browser.");
    } catch (error) {
      // Dismissing the share sheet rejects with `AbortError`. That is the user
      // declining, not a failure, so it says nothing rather than reporting an
      // error they caused on purpose.
      if (error instanceof Error && error.name === "AbortError") {
        setShareMessage(null);
        return;
      }

      // Anything else is a refusal the homeowner did not choose — a clipboard
      // write denied by permission, most often. Staying silent there would
      // leave them believing the brief went somewhere it did not.
      setShareMessage("Could not share the brief.");
    }
  };

  // After the hooks, matching the other result-backed screens: a brief for an
  // assessment that was never run would be a document full of placeholder
  // figures with an installer's name on it.
  if (!result) {
    return <Navigate to={ROUTE_PATHS.energy} replace />;
  }

  const panelClassPicker = activeBuild ? null : (
    // A chosen design already fixes the equipment, so the generic panel-class
    // picker only renders when no design was made — its re-sized figures would
    // contradict the design one column over.
    <section className="flex w-full flex-col gap-3" aria-label="Panel class">
      <Eyebrow as="h2">Panel class</Eyebrow>

      <div className="flex flex-wrap gap-2">
        {PANEL_CLASS_OPTIONS.map((option) => (
          <Chip
            key={option.id}
            selected={brief.panelCategoryId === option.id}
            onClick={() => setPanelClassOverride(option.id)}
          >
            {option.label}
          </Chip>
        ))}
      </div>

      <p className="font-sans text-[14px] text-tertiary-ink">
        {brief.panelClassHint}
      </p>
    </section>
  );

  return (
    <div className="flex min-h-svh flex-col bg-paper">
      <main
        id="main"
        className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-6 pt-8 pb-16 lg:px-16"
      >
        <div className="flex overflow-x-auto sm:justify-center print:hidden">
          <DesignFlowStepper activeStep={5} />
        </div>

        <StepPageHeader
          backHref={ROUTE_PATHS.quotation}
          backLabel="Back to your quotation"
          eyebrow="Project brief"
          title="Your project brief."
          lead={
            <p>
              {brief.locationLabel} ·{" "}
              <span className="text-cobalt">
                {brief.confidencePercent}% confidence
              </span>
            </p>
          }
          actions={
            <>
              <button
                type="button"
                onClick={handleShare}
                className="order-last px-3 py-2 font-sans text-[14px] font-semibold text-cobalt hover:underline sm:order-none"
              >
                Share with installer
              </button>
              <ButtonLink
                to={ROUTE_PATHS.report}
                variant="ghost"
                className="h-12 px-5"
              >
                Download PDF
              </ButtonLink>
              <ButtonLink
                to={ROUTE_PATHS.permits}
                className="order-first h-12 px-6 sm:order-none"
              >
                Check permit requirements
                <CtaArrow />
              </ButtonLink>
            </>
          }
        />

        {/* Announced, not just shown: the button that triggers it gives no
            other sign that anything happened. */}
        <p
          role="status"
          className="-mt-4 font-sans text-[14px] text-secondary empty:hidden xl:text-right"
        >
          {shareMessage}
        </p>

        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="flex min-w-0 flex-col gap-8">
            <BriefRoofPhoto
              locationLabel={brief.locationLabel}
              selectedProperty={selectedProperty}
              roofPolygon={roofPolygon}
              // The layout drawn is the one being bought: the chosen design's
              // panel count when a design exists, the engine's otherwise.
              panelCount={activeBuild?.panel_count ?? brief.panelCount}
              panelWidthM={brief.panelWidthM}
              panelHeightM={brief.panelHeightM}
            />

            <SpecSection title="System" rows={brief.systemRows} />

            {activeBuild ? (
              <>
                <SpecSection
                  title="Chosen design"
                  rows={buildDesignRows(activeBuild)}
                />
                <BriefSystemDiagram build={activeBuild} />
              </>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-col gap-8">
            {panelClassPicker}

            <SpecSection
              title="Financials"
              rows={
                activeBuild
                  ? buildDesignFinancialRows(activeBuild)
                  : brief.financialRows
              }
            />

            {quote ? (
              <SpecSection title="Quotation" rows={buildQuotationRows(quote)} />
            ) : null}

            <p className="border-l-2 border-hairline pl-3 font-sans text-[13px] leading-5 text-tertiary-ink">
              {brief.disclaimer}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
