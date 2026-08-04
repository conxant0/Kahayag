import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { ROUTE_PATHS } from "../../app/routePaths";
import {
  formatAnnualGeneration,
  formatBudgetCompatibility,
  formatCostRange,
  formatLimitingConstraint,
  formatMonthlySavings,
  formatOffset,
  formatPaybackYears,
  formatPeso,
  formatShadingImpact,
  formatSolarResourceSource,
  formatSystemCapacity,
  readAssessmentResult,
} from "../assessment/formatAssessmentResult";
import { FlowLayout } from "../../shared/components/layout";
import {
  Accordion,
  AccordionItem,
  Button,
  ButtonLink,
  HairlineList,
  HairlineRow,
  InfoPill,
} from "../../shared/components/ui";
import { useAssessmentStore } from "../../state/assessmentStore";
import { useFluxCacheStore } from "../../state/fluxCacheStore";
import { computeFluxCacheKey } from "./fluxCacheKey";
import { layoutPanelsInPolygon } from "./panelLayoutUtils";
import { preloadFluxLayersForAssessment } from "./preloadFluxLayers";
import { ResultsMapPane } from "./components/ResultsMapPane";

const SIZING_HEADLINES: Record<string, string> = {
  demand: "Sized to your electricity use",
  budget: "Sized to your budget",
  roof_area: "Sized to your roof's maximum",
};

export function ResultsPage() {
  const rawResult = useAssessmentStore((state) => state.result);
  const selectedProperty = useAssessmentStore(
    (state) => state.selectedProperty,
  );
  const roofPolygon = useAssessmentStore((state) => state.roofPolygon);
  const fluxEntry = useFluxCacheStore((state) => state.entry);
  const result = readAssessmentResult(rawResult);
  const [showFlux, setShowFlux] = useState(false);
  const [fluxError, setFluxError] = useState<string | null>(null);
  const roofCoordinates = roofPolygon?.coordinates ?? [];
  const fluxKey = computeFluxCacheKey({
    roofCoordinates,
    selectedProperty,
  });
  const cachedFlux = fluxEntry?.key === fluxKey ? fluxEntry : null;
  const loadFlux = useCallback(() => {
    if (!result) {
      return;
    }
    void preloadFluxLayersForAssessment({
      result,
      selectedProperty,
      roofPolygon,
    }).catch(() => {
      setFluxError(
        "Sunshine overlay is unavailable. Your assessment remains usable.",
      );
    });
  }, [result, roofPolygon, selectedProperty]);

  useEffect(() => {
    loadFlux();
  }, [loadFlux]);

  if (!result) {
    return <Navigate to={ROUTE_PATHS.energy} replace />;
  }

  const panelCount = result.recommendation.panel_count;
  const shadingImpact = formatShadingImpact(result);
  const panelWidthM = Number(result.assumptions.panel_width_m);
  const panelHeightM = Number(result.assumptions.panel_height_m);

  const panels = layoutPanelsInPolygon({
    coordinates: roofCoordinates,
    panelCount,
    panelWidthM,
    panelHeightM,
    flux: cachedFlux?.flux,
  });

  // The sizing card and hairline list are passed to FlowLayout's `children`
  // slot (not `lead`) so they land after the map in DOM order. `lead` and
  // `pane` render before `children` in FlowLayout's fixed slot order, which
  // is also mobile's scroll order, so this alone gets the mobile stack right
  // — savings figure/caption (lead), map (pane), then this pair and the
  // accordion (children) — with no CSS reordering needed. On desktop,
  // `children` lands directly under `lead` in the same rail column exactly
  // where this pair used to sit, except FlowLayout gives that slot `lg:pt-8`
  // of its own top padding (for the accordion, which has no sibling above it
  // today). `lg:-mt-3.5` on the first item cancels that back down to the
  // `lg:gap-4.5` rhythm the rest of the rail uses, so desktop is unchanged.
  const sizingCard = (
    <div className="flex flex-col gap-1.5 rounded-map border border-hairline p-3 lg:-mt-3.5 lg:gap-2 lg:p-4">
      <InfoPill className="w-fit">
        {SIZING_HEADLINES[result.recommendation.limiting_constraint] ??
          "How this was sized"}
      </InfoPill>
      <p className="font-sans text-sm leading-relaxed text-secondary lg:text-[15px]">
        {result.recommendation.rationale}
      </p>
    </div>
  );
  const hairlineList = (
    <HairlineList className="pt-1.5">
      <HairlineRow label="Panels" value={`${panelCount} panels`} />
      <HairlineRow label="System size" value={formatSystemCapacity(result)} />
      <HairlineRow
        label="Yearly yield"
        value={formatAnnualGeneration(result)}
      />
      {shadingImpact ? (
        <HairlineRow label="Shading" value={shadingImpact} />
      ) : null}
      <HairlineRow label="Offset" value={formatOffset(result)} />
      <HairlineRow label="Payback" value={formatPaybackYears(result)} />
      <HairlineRow label="Estimated cost" value={formatCostRange(result)} />
      <HairlineRow
        label="Back per year"
        value={`≈ ${formatPeso(result.financials.annual_savings_php)}`}
      />
    </HairlineList>
  );

  return (
    <FlowLayout
      step="Your preliminary result"
      title={
        <>
          Good news — solar <em className="font-normal italic">pays off.</em>
        </>
      }
      titleClassName="lg:text-[48px]"
      railClassName="lg:gap-4.5"
      backHref={ROUTE_PATHS.energy}
      backLabel="Back to your bill"
      nextHref={ROUTE_PATHS.invest}
      nextLabel="See your investment"
      pane={
        <ResultsMapPane
          selectedProperty={selectedProperty}
          roofCoordinates={roofCoordinates}
          panels={panels}
          status={result.is_provisional ? "Preliminary estimate" : undefined}
          flux={showFlux ? cachedFlux?.flux : null}
          mask={showFlux ? cachedFlux?.mask : null}
        />
      }
      lead={
        <>
          <p className="font-serif text-[56px] leading-none font-medium text-ink lg:text-[96px]">
            {formatMonthlySavings(result)}
          </p>
          <div className="h-0.75 w-40 bg-sun lg:w-60" />
          <p className="font-sans text-sm font-medium text-tertiary-ink">
            saved every month
          </p>
        </>
      }
      beforeCta={
        <ButtonLink to={ROUTE_PATHS.editLayout} variant="secondary" fullWidth>
          Edit layout
        </ButtonLink>
      }
    >
      {sizingCard}
      {hairlineList}

      {/*
        Detail content, below the pane on mobile. Bounded and internally
        scrollable from `lg:` up so an opened accordion panel can never push
        the CTA action bar (a separate row in FlowLayout) below the fold —
        the always-visible summary above stays outside this box.
      */}
      <div className="w-full lg:max-h-[38svh] lg:overflow-y-auto lg:pr-1">
        <Accordion>
          <AccordionItem title="Assessment result details" defaultOpen>
            <HairlineList>
              <HairlineRow
                label="Budget compatibility"
                value={formatBudgetCompatibility(result)}
                valueClassName={
                  result.financials.budget_compatible
                    ? "text-cobalt"
                    : undefined
                }
              />
              <HairlineRow
                label="Monthly savings"
                value={formatMonthlySavings(result)}
              />
              <HairlineRow
                label="Limiting constraint"
                value={formatLimitingConstraint(result)}
              />
              <HairlineRow
                label="Budget"
                value={formatPeso(result.inputs.budget_php)}
              />
            </HairlineList>
          </AccordionItem>

          {result.shading ? (
            <AccordionItem title="Sunshine visualization">
              <Button
                variant="ghost"
                onClick={() => {
                  if (cachedFlux) {
                    setShowFlux((visible) => !visible);
                  } else {
                    setFluxError(null);
                    loadFlux();
                  }
                }}
              >
                {cachedFlux
                  ? showFlux
                    ? "Hide sunshine overlay"
                    : "Show sunshine overlay"
                  : "Load sunshine overlay"}
              </Button>
              {fluxError ? (
                <p className="font-sans text-sm text-secondary">
                  {fluxError}
                </p>
              ) : null}
            </AccordionItem>
          ) : null}

          <AccordionItem title="Assumptions">
            <HairlineList>
              <HairlineRow
                label="Peak sun hours/day"
                value={Number(
                  result.assumptions.peak_sun_hours_per_day,
                ).toFixed(1)}
              />
              <HairlineRow
                label="Performance ratio"
                value={`${Math.round(Number(result.assumptions.performance_ratio) * 100)}%`}
              />
              <HairlineRow
                label="Solar resource"
                value={formatSolarResourceSource(result)}
              />
              <HairlineRow
                label="Panel dimensions"
                value={`${result.assumptions.panel_width_m} × ${result.assumptions.panel_height_m} m`}
              />
            </HairlineList>
            <p className="font-sans text-sm leading-relaxed text-secondary">
              Cost includes {result.assumptions.cost_inclusions.join(", ")}.
            </p>
            <p className="font-sans text-sm leading-relaxed text-secondary">
              Potential exclusions:{" "}
              {result.assumptions.potential_exclusions.join(", ")}.
            </p>
          </AccordionItem>

          <AccordionItem
            title={
              result.is_provisional
                ? "Preliminary assessment"
                : "Limitations"
            }
          >
            {result.limitations.map((limitation) => (
              <p
                key={limitation}
                className="font-sans text-sm leading-relaxed text-secondary"
              >
                {limitation}
              </p>
            ))}
          </AccordionItem>
        </Accordion>
      </div>
    </FlowLayout>
  );
}
