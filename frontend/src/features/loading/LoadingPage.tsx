import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { ROUTE_PATHS } from "../../app/routePaths";
import { Eyebrow, KahayagLoader } from "../../shared/components/ui";
import { usePrefersReducedMotion } from "../../shared/hooks/usePrefersReducedMotion";
import { useAssessmentStore } from "../../state/assessmentStore";
import { useFluxCacheStore } from "../../state/fluxCacheStore";
import { buildAssessmentPayload } from "../assessment/buildAssessmentPayload";
import { readAssessmentResult } from "../assessment/formatAssessmentResult";
import { useSubmitAssessment } from "../assessment/hooks/useSubmitAssessment";
import { resolveRedirectForStep } from "../assessment/sessionGuard";
import {
  computeFluxCacheKey,
  needsFluxForPanelLayout,
} from "../results/fluxCacheKey";
import { preloadFluxLayersForAssessment } from "../results/preloadFluxLayers";
import { LoadingProgressBar } from "./LoadingProgressBar";
import { useLoadingProgress, type LoadingPhase } from "./useLoadingProgress";

/**
 * /loading — Figma 2174:60.
 *
 * Submits the assessment, preloads solar flux for panel placement, then routes
 * to /results when everything is ready.
 *
 * The two phases are separate because only one of them is required. The
 * assessment is the product; the flux map only improves where panels are drawn,
 * so its failure offers a way on rather than sending the homeowner back.
 */
const ASSESSMENT_MESSAGES = [
  "Reading ten years of sunlight…",
  "Measuring what your roof can hold…",
  "Checking your rate against VECO’s…",
  "Working out when it pays back…",
];

const FLUX_MESSAGES = [
  "Mapping sunshine across your roof…",
  "Finding the brightest spots for your panels…",
  "Optimizing your panel layout…",
];

const ALL_LOADING_MESSAGES = [...ASSESSMENT_MESSAGES, ...FLUX_MESSAGES];

const MESSAGE_MS = 2200;

/** Lets the finished bar be seen before the screen changes. */
const SETTLE_MS = 280;

export function LoadingPage() {
  const prefersReduced = usePrefersReducedMotion();
  const navigate = useNavigate();

  const [index, setIndex] = useState(0);
  const [fluxError, setFluxError] = useState<string | null>(null);
  const [isFluxRunning, setIsFluxRunning] = useState(false);
  const hasStartedFluxPreload = useRef(false);

  const rawResult = useAssessmentStore((state) => state.result);
  const selectedProperty = useAssessmentStore(
    (state) => state.selectedProperty,
  );
  const roofPolygon = useAssessmentStore((state) => state.roofPolygon);
  const energyInputs = useAssessmentStore((state) => state.energyInputs);
  const fluxCacheEntry = useFluxCacheStore((state) => state.entry);
  const result = readAssessmentResult(rawResult);

  const redirect = resolveRedirectForStep("loading", {
    selectedProperty,
    roofPolygon,
    energyInputs,
  });

  const { mutate, isPending, isSuccess, error } = useSubmitAssessment();

  // The second phase begins exactly when the assessment lands, so it is read
  // off the request rather than tracked alongside it, where the two could
  // disagree for a render.
  const phase: LoadingPhase = isSuccess ? "flux" : "assessment";

  const { progress, completeProgress } = useLoadingProgress({
    phase,
    isAssessmentPending: isPending,
    isAssessmentComplete: isSuccess,
    isFluxRunning,
    hasError: Boolean(error || fluxError),
    prefersReducedMotion: prefersReduced,
  });

  // Built here rather than on the previous screen so a session restored from
  // storage submits exactly what it holds. Anything missing throws, which the
  // guard above has already turned into a redirect.
  const payload = useMemo(() => {
    try {
      return buildAssessmentPayload({
        selectedProperty,
        roofPolygon,
        energyInputs,
      });
    } catch {
      return null;
    }
  }, [selectedProperty, roofPolygon, energyInputs]);

  const runFluxPreload = useCallback(async () => {
    if (!result || !selectedProperty) {
      return;
    }

    setFluxError(null);
    setIsFluxRunning(true);

    await preloadFluxLayersForAssessment({
      result,
      selectedProperty,
      roofPolygon,
    });

    completeProgress();
    await new Promise((resolve) => window.setTimeout(resolve, SETTLE_MS));
    navigate(ROUTE_PATHS.results, { replace: true });
  }, [completeProgress, navigate, result, roofPolygon, selectedProperty]);

  const startFluxPreload = useCallback(() => {
    hasStartedFluxPreload.current = true;

    runFluxPreload().catch((preloadError: unknown) => {
      hasStartedFluxPreload.current = false;
      setIsFluxRunning(false);
      setFluxError(
        preloadError instanceof Error
          ? preloadError.message
          : "Solar flux preload failed.",
      );
    });
  }, [runFluxPreload]);

  // The message carousel is decorative and runs on its own clock. Tying it to
  // request state would leave a single sentence frozen on a slow response,
  // which reads as a hang.
  useEffect(() => {
    const cycle = window.setInterval(() => {
      setIndex((current) => (current + 1) % ALL_LOADING_MESSAGES.length);
    }, MESSAGE_MS);
    return () => window.clearInterval(cycle);
  }, []);

  // `redirect` is checked here as well as before the render: an effect still
  // runs on the pass that returns `<Navigate>`, and submitting an assessment on
  // the way out is exactly what the guard exists to prevent.
  useEffect(() => {
    if (redirect || !payload || isPending || isSuccess) {
      return;
    }

    mutate(payload);
  }, [redirect, payload, isPending, isSuccess, mutate]);

  useEffect(() => {
    if (!isSuccess) {
      return;
    }

    const roofCoordinates = roofPolygon?.coordinates ?? [];
    const cacheKey = computeFluxCacheKey({ roofCoordinates, selectedProperty });

    // Already prepared for this exact roof on this exact property: re-fetching
    // several megabytes of raster to arrive at the same overlay is only a delay.
    if (fluxCacheEntry?.key === cacheKey) {
      completeProgress();
      navigate(ROUTE_PATHS.results, { replace: true });
      return;
    }

    const shouldPreloadFlux = needsFluxForPanelLayout({
      shading: result?.shading,
      roofCoordinates,
      panelCount: result?.recommendation.panel_count ?? 0,
    });

    if (!shouldPreloadFlux) {
      completeProgress();
      navigate(ROUTE_PATHS.results, { replace: true });
      return;
    }

    if (hasStartedFluxPreload.current) {
      return;
    }

    startFluxPreload();
  }, [
    completeProgress,
    fluxCacheEntry?.key,
    isSuccess,
    navigate,
    result,
    roofPolygon,
    selectedProperty,
    startFluxPreload,
  ]);

  // A session that cannot produce a payload is missing an answer, not failing
  // a request, so it goes back to the step that collects the answer rather than
  // showing an error beside a stalled bar.
  if (redirect) {
    return <Navigate to={redirect} replace />;
  }

  const submissionError = error instanceof Error ? error.message : null;
  const errorMessage = submissionError ?? fluxError;

  return (
    <main
      id="main"
      className="flex min-h-svh flex-col items-center justify-center gap-5 bg-paper px-(--gutter)"
    >
      <h1 className="sr-only">Analyzing your roof</h1>

      <KahayagLoader
        size="clamp(140px, 28vw, 189px)"
        label="Analyzing your roof"
      />

      <Eyebrow>
        {phase === "flux" ? "Panel layout" : "Prediction engine"}
      </Eyebrow>

      <p
        aria-live="polite"
        className="min-h-[3.25rem] text-center font-serif text-[21px] text-ink italic transition-opacity duration-300 ease-brand lg:min-h-[3.75rem] lg:text-[26px]"
      >
        {errorMessage ??
          ALL_LOADING_MESSAGES[index % ALL_LOADING_MESSAGES.length]}
      </p>

      <LoadingProgressBar progress={progress} />

      {errorMessage ? (
        <div className="flex flex-col items-center gap-3 pt-2 text-center">
          <p className="font-sans text-[13px] font-medium text-secondary">
            {submissionError
              ? "We couldn’t finish the assessment."
              : "We couldn’t prepare the solar flux map."}
          </p>

          {submissionError ? (
            <>
              <Link
                to={ROUTE_PATHS.energy}
                className="font-sans text-[15px] font-semibold text-cobalt hover:underline"
              >
                Back to your bill
              </Link>
              {/* Past the guard, so a payload exists and can be resent. */}
              <button
                type="button"
                onClick={() => payload && mutate(payload)}
                className="font-sans text-[15px] font-semibold text-cobalt hover:underline"
              >
                Try again
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={startFluxPreload}
                className="font-sans text-[15px] font-semibold text-cobalt hover:underline"
              >
                Try again
              </button>
              {/* The assessment is complete and usable; only the overlay is
                  missing, so the way on stays open. */}
              <button
                type="button"
                onClick={() => navigate(ROUTE_PATHS.results, { replace: true })}
                className="font-sans text-[15px] font-semibold text-cobalt hover:underline"
              >
                Continue without flux map
              </button>
            </>
          )}
        </div>
      ) : (
        <p className="font-sans text-[13px] font-medium text-secondary">
          {phase === "flux"
            ? "Placing panels on the sunniest roof areas"
            : "Analyzing your roof · about a minute"}
        </p>
      )}
    </main>
  );
}
