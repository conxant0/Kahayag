import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { ROUTE_PATHS } from "../../app/routePaths";
import {
  formatAnnualGeneration,
  formatBudgetCompatibility,
  formatCostRange,
  formatMonthlySavings,
  formatOffset,
  formatPaybackYears,
  formatPeso,
  formatShadingImpact,
  formatSystemCapacity,
  readAssessmentResult,
} from "../assessment/formatAssessmentResult";
import { FlowLayout } from "../../shared/components/layout";
import {
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
import { PanelLayoutPreview } from "./components/PanelLayoutPreview";

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
        <PanelLayoutPreview
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
          <p className="font-serif text-lg text-secondary italic">
            {result.recommendation.rationale}
          </p>
          <HairlineList className="pt-1.5">
            <HairlineRow label="Panels" value={`${panelCount} panels`} />
            <HairlineRow
              label="System size"
              value={formatSystemCapacity(result)}
            />
            <HairlineRow
              label="Yearly yield"
              value={formatAnnualGeneration(result)}
            />
            {shadingImpact ? (
              <HairlineRow label="Shading" value={shadingImpact} />
            ) : null}
            <HairlineRow label="Offset" value={formatOffset(result)} />
            <HairlineRow label="Payback" value={formatPaybackYears(result)} />
            <HairlineRow
              label="Estimated cost"
              value={formatCostRange(result)}
            />
            <HairlineRow
              label="Back per year"
              value={`≈ ${formatPeso(result.financials.annual_savings_php)}`}
            />
          </HairlineList>
        </>
      }
      beforeCta={
        <>
          <ButtonLink to={ROUTE_PATHS.invest} variant="secondary" fullWidth>
            See your investment
          </ButtonLink>
          <ButtonLink to={ROUTE_PATHS.editLayout} variant="secondary" fullWidth>
            Edit layout
          </ButtonLink>
        </>
      }
    >
      <section
        className="flex w-full flex-col gap-3"
        aria-label="Assessment result"
      >
        <HairlineList>
          <HairlineRow
            label="Budget compatibility"
            value={formatBudgetCompatibility(result)}
            valueClassName={
              result.financials.budget_compatible ? "text-cobalt" : undefined
            }
          />
          <HairlineRow
            label="Monthly savings"
            value={formatMonthlySavings(result)}
          />
          <HairlineRow
            label="Limiting constraint"
            value={result.recommendation.limiting_constraint}
          />
          <HairlineRow
            label="Budget"
            value={formatPeso(result.inputs.budget_php)}
          />
        </HairlineList>
      </section>

      {result.shading ? (
        <section
          className="flex w-full flex-col gap-2"
          aria-label="Sunshine visualization"
        >
          <h2 className="font-sans text-sm font-semibold tracking-[1.2px] text-cobalt uppercase">
            Sunshine visualization
          </h2>
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
            <p className="font-sans text-sm text-secondary">{fluxError}</p>
          ) : null}
        </section>
      ) : null}

      <section className="flex w-full flex-col gap-3" aria-label="Assumptions">
        <h2 className="font-sans text-sm font-semibold tracking-[1.2px] text-cobalt uppercase">
          Assumptions
        </h2>
        <HairlineList>
          <HairlineRow
            label="Peak sun hours/day"
            value={Number(result.assumptions.peak_sun_hours_per_day).toFixed(1)}
          />
          <HairlineRow
            label="Performance ratio"
            value={`${Math.round(Number(result.assumptions.performance_ratio) * 100)}%`}
          />
          <HairlineRow
            label="Solar resource"
            value={result.assumptions.solar_resource_source}
          />
          <HairlineRow
            label="Panel dimensions"
            value={`${result.assumptions.panel_width_m} × ${result.assumptions.panel_height_m} m`}
          />
        </HairlineList>
        <p className="font-sans text-sm text-secondary">
          Cost includes {result.assumptions.cost_inclusions.join(", ")}.
        </p>
        <p className="font-sans text-sm text-secondary">
          Potential exclusions:{" "}
          {result.assumptions.potential_exclusions.join(", ")}.
        </p>
      </section>

      <section className="flex w-full flex-col gap-2" aria-label="Limitations">
        <h2 className="font-sans text-sm font-semibold tracking-[1.2px] text-cobalt uppercase">
          {result.is_provisional ? "Preliminary assessment" : "Limitations"}
        </h2>
        {result.limitations.map((limitation) => (
          <p key={limitation} className="font-sans text-sm text-secondary">
            {limitation}
          </p>
        ))}
      </section>
    </FlowLayout>
  );
}
