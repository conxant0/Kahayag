import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { ROUTE_PATHS } from "../../app/routePaths";
import {
  formatMonthlySavings,
  formatSystemCapacity,
  readAssessmentResult,
} from "../assessment/formatAssessmentResult";
import { FlowLayout } from "../../shared/components/layout";
import { Button, Eyebrow, Rule, Slider } from "../../shared/components/ui";
import {
  useAssessmentStore,
  type CompletedAssessment as StoreAssessmentResult,
} from "../../state/assessmentStore";
import { useFluxCacheStore } from "../../state/fluxCacheStore";
import { computeFluxCacheKey } from "./fluxCacheKey";
import { useAdjustPanelCount } from "./hooks/useAdjustPanelCount";
import {
  mergePanelAdjustment,
  type PanelCountAdjustmentResponse,
} from "./panelCountAdjustment";
import { layoutPanelsInPolygon } from "./panelLayoutUtils";
import { resolveLayoutContext } from "./layoutContext";
import { PanelLayoutPreview } from "./components/PanelLayoutPreview";
import { ResultsMapPane } from "./components/ResultsMapPane";

export function EditLayoutPage() {
  const navigate = useNavigate();
  const rawResult = useAssessmentStore((state) => state.result);
  const setResult = useAssessmentStore((state) => state.setResult);
  const selectedProperty = useAssessmentStore(
    (state) => state.selectedProperty,
  );
  const roofPolygon = useAssessmentStore((state) => state.roofPolygon);
  const fluxEntry = useFluxCacheStore((state) => state.entry);
  const result = readAssessmentResult(rawResult);
  const { mutateAsync, isPending } = useAdjustPanelCount();
  const requestId = useRef(0);
  const isInitialPanelCount = useRef(true);
  const [requestedPanelCount, setRequestedPanelCount] = useState(
    () => result?.recommendation.panel_count ?? 0,
  );
  const [candidateAdjustment, setCandidateAdjustment] =
    useState<PanelCountAdjustmentResponse | null>(null);
  const [adjustmentError, setAdjustmentError] = useState<string | null>(null);

  const layoutContext = useMemo(
    () => (result ? resolveLayoutContext({ result, roofPolygon }) : null),
    [result, roofPolygon],
  );
  const initialPanelCount = layoutContext?.currentPanelCount ?? 0;
  const maxPanels = Math.max(
    1,
    layoutContext?.maxPanels ?? 0,
    initialPanelCount,
  );

  useEffect(() => {
    if (isInitialPanelCount.current) {
      isInitialPanelCount.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      setRequestedPanelCount(initialPanelCount);
      setCandidateAdjustment(null);
      setAdjustmentError(null);
    });
    return () => window.clearTimeout(timer);
  }, [initialPanelCount, result]);

  useEffect(() => {
    if (
      !result ||
      requestedPanelCount < 1 ||
      requestedPanelCount === initialPanelCount
    ) {
      return;
    }

    const currentRequestId = ++requestId.current;
    const timer = window.setTimeout(() => {
      void mutateAsync({ result, requestedPanelCount })
        .then((response) => {
          if (currentRequestId === requestId.current) {
            setCandidateAdjustment(response);
          }
        })
        .catch((error: unknown) => {
          if (currentRequestId === requestId.current) {
            setAdjustmentError(
              error instanceof Error
                ? error.message
                : "Could not update the panel count.",
            );
          }
        });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [initialPanelCount, mutateAsync, requestedPanelCount, result]);

  if (!result || !layoutContext) {
    return <Navigate to={ROUTE_PATHS.energy} replace />;
  }

  const roofCoordinates = layoutContext.coordinates;
  const fluxKey = computeFluxCacheKey({
    roofCoordinates,
    selectedProperty,
  });
  const cachedFlux = fluxEntry?.key === fluxKey ? fluxEntry : null;
  const panels = layoutPanelsInPolygon({
    coordinates: roofCoordinates,
    panelCount: requestedPanelCount,
    panelWidthM: layoutContext.panelWidthM,
    panelHeightM: layoutContext.panelHeightM,
    flux: cachedFlux?.flux,
  });
  const recommendation =
    candidateAdjustment?.recommendation ?? result.recommendation;
  const financials = candidateAdjustment?.financials ?? result.financials;
  const canSave =
    requestedPanelCount === initialPanelCount || candidateAdjustment !== null;

  const handlePanelCountChange = (next: number) => {
    setRequestedPanelCount(next);
    setCandidateAdjustment(null);
    setAdjustmentError(null);
  };

  const handleSave = () => {
    if (candidateAdjustment) {
      setResult(
        mergePanelAdjustment(
          result,
          candidateAdjustment,
        ) as unknown as StoreAssessmentResult,
      );
    }
    navigate(ROUTE_PATHS.results);
  };

  return (
    <FlowLayout
      step="Edit layout"
      title="Adjust your panels."
      railClassName="lg:gap-4.5"
      backHref={ROUTE_PATHS.results}
      backLabel="Back to results"
      nextLabel={isPending ? "Updating…" : "Save layout"}
      onNext={handleSave}
      nextDisabled={isPending || !canSave}
      nextLoading={isPending}
      pane={
        <div className="flex max-h-full flex-col gap-3 overflow-y-auto">
          <div className="h-56 shrink-0">
            <PanelLayoutPreview
              roofCoordinates={roofCoordinates}
              panels={panels}
              status={adjustmentError ?? "Panel placement preview"}
            />
          </div>
          <div className="h-56 shrink-0">
            <ResultsMapPane
              selectedProperty={selectedProperty}
              roofCoordinates={roofCoordinates}
              panels={panels}
              flux={cachedFlux?.flux}
              mask={cachedFlux?.mask}
            />
          </div>
        </div>
      }
      lead={
        <p className="font-sans text-[15px] text-secondary">
          Slide to set panel count — placement updates live.
        </p>
      }
    >
      <Slider
        label="Panels"
        min={1}
        max={maxPanels}
        value={Math.min(Math.max(requestedPanelCount, 1), maxPanels)}
        onChange={handlePanelCountChange}
        formatValue={(value) => `${value} of ${maxPanels} max`}
      />

      <div className="flex flex-col gap-2">
        <Button
          variant="ghost"
          onClick={() =>
            handlePanelCountChange(result.recommendation.panel_count)
          }
          disabled={requestedPanelCount === result.recommendation.panel_count}
        >
          Set recommended
        </Button>
        <Button
          variant="ghost"
          onClick={() => handlePanelCountChange(initialPanelCount)}
          disabled={requestedPanelCount === initialPanelCount}
        >
          <span aria-hidden="true">↺</span> Reset layout
        </Button>
      </div>

      <section
        className="flex w-full flex-col gap-2.5 pt-1"
        aria-label="Live results"
      >
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="size-1.5 shrink-0 rounded-full bg-cobalt"
          />
          <Eyebrow tone="cobalt" className="text-[10px] tracking-[1.2px]">
            Live results — updates as you edit
          </Eyebrow>
        </span>
        <Rule />
        <dl className="flex items-start py-0.5">
          <div className="min-w-0 flex-1 pr-3.5">
            <dd className="font-sans text-[21px] font-semibold text-ink">
              {recommendation.panel_count}
            </dd>
            <dt className="font-sans text-[11px] text-secondary">panels</dt>
          </div>
          <div className="min-w-0 flex-1 border-l border-hairline pl-3.5">
            <dd className="font-sans text-[21px] font-semibold text-ink">
              {formatSystemCapacity({ ...result, recommendation, financials })}
            </dd>
            <dt className="font-sans text-[11px] text-secondary">system</dt>
          </div>
          <div className="min-w-0 flex-1 border-l border-hairline pl-3.5">
            <dd className="font-sans text-[21px] font-semibold text-cobalt">
              {formatMonthlySavings({ ...result, recommendation, financials })}
            </dd>
            <dt className="font-sans text-[11px] text-secondary">per month</dt>
          </div>
        </dl>
      </section>

      {adjustmentError ? (
        <p className="font-sans text-sm text-red-700" role="alert">
          {adjustmentError}
        </p>
      ) : null}
    </FlowLayout>
  );
}
