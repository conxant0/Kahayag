import { useCallback, useEffect, useMemo, useState } from "react";
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
} from "../../shared/components/ui";
import { useAssessmentStore } from "../../state/assessmentStore";
import { useFluxCacheStore } from "../../state/fluxCacheStore";
import { computeFluxCacheKey } from "./fluxCacheKey";
import { layoutPanelsInPolygon } from "./panelLayoutUtils";
import { preloadFluxLayersForAssessment } from "./preloadFluxLayers";
import { ResultsMapPane } from "./components/ResultsMapPane";

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
  const roofCoordinates = useMemo(
    () => roofPolygon?.coordinates ?? [],
    [roofPolygon],
  );
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

  const panels = useMemo(() => {
    if (!result) {
      return [];
    }
    return layoutPanelsInPolygon({
      coordinates: roofCoordinates,
      panelCount: result.recommendation.panel_count,
      panelWidthM: Number(result.assumptions.panel_width_m),
      panelHeightM: Number(result.assumptions.panel_height_m),
      flux: cachedFlux?.flux,
    });
  }, [roofCoordinates, result, cachedFlux?.flux]);

  if (!result) {
    // The result is memory-only; a refresh lands here without one. /loading
    // recomputes it from the persisted inputs (its guard walks further back
    // when those are missing too) instead of dumping the visitor on the
    // bill screen.
    return <Navigate to={ROUTE_PATHS.loading} replace />;
  }

  const panelCount = result.recommendation.panel_count;
  const shadingImpact = formatShadingImpact(result);
  const hasBudget = result.inputs.budget_php != null;

  // One list carries every headline fact. The monthly figure already owns the
  // top of the rail, so it is deliberately not repeated here.
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
        label="Saved per year"
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
      nextHref={ROUTE_PATHS.design}
      nextLabel="Design your system"
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
        // One light row for the side journeys; the sun pill below stays the
        // only full-weight action, per "yellow acts".
        <div className="flex gap-2">
          <ButtonLink to={ROUTE_PATHS.invest} variant="ghost" fullWidth>
            See your investment
          </ButtonLink>
          <ButtonLink to={ROUTE_PATHS.editLayout} variant="ghost" fullWidth>
            Edit layout
          </ButtonLink>
        </div>
      }
    >
      {/*
        Scrollable rail content below the savings figure. FlowLayout gives this
        slot the grid's 1fr row, so its height is whatever's left after the
        heading/savings figure and the action bar — never more, never a
        guessed constant. lg:min-h-0 lets that row actually shrink to fit
        instead of growing to the accordion's full content height, which is
        the default for a grid item.
      */}
      <div className="w-full lg:min-h-0 lg:overflow-y-auto lg:pr-1">
        {/*
          Four sections, one open. "Your system" is the only default-open block
          and carries every headline fact once — the old layout opened two
          lists at once and repeated the savings and cost figures across them.
        */}
        <Accordion>
          <AccordionItem title="Your system" defaultOpen as="h2">
            {hairlineList}
          </AccordionItem>

          <AccordionItem title={`Why ${panelCount} panels`} as="h2">
            <p className="font-sans text-sm leading-relaxed text-secondary lg:text-[15px]">
              {result.recommendation.rationale}
            </p>
            <HairlineList>
              <HairlineRow
                label="Sized by"
                value={formatLimitingConstraint(result)}
              />
              {hasBudget ? (
                <HairlineRow
                  label="Your budget"
                  value={formatPeso(result.inputs.budget_php)}
                />
              ) : null}
              {hasBudget ? (
                <HairlineRow
                  label="Budget fit"
                  value={formatBudgetCompatibility(result)}
                  valueClassName={
                    result.financials.budget_compatible
                      ? "text-cobalt"
                      : undefined
                  }
                />
              ) : null}
            </HairlineList>
          </AccordionItem>

          {result.shading ? (
            <AccordionItem title="Sunshine overlay" as="h2">
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

          <AccordionItem title="Assumptions & limitations" as="h2">
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
