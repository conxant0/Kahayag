import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";

import { ROUTE_PATHS } from "../../app/routePaths";
import { FlowLayout, DesignFlowStepper } from "../../shared/components/layout";
import { Eyebrow } from "../../shared/components/ui";
import { readAssessmentResult } from "../assessment/formatAssessmentResult";
import { useAssessmentStore } from "../../state/assessmentStore";
import { useDesignStore } from "../../state/designStore";
import { DesignAppliedModal } from "./DesignAppliedModal";
import { DesignSidebar } from "./DesignSidebar";
import { SystemCanvas } from "./SystemCanvas";
import { formatBuildInvestment, getActiveBuild, summaryTiles } from "./designViewModel";
import { useBootstrapDesign } from "./useDesignActions";

export function DesignPage() {
  const rawResult = useAssessmentStore((state) => state.result);
  const selectedProperty = useAssessmentStore((state) => state.selectedProperty);
  const designSession = useDesignStore((state) => state.designSession);
  const applyDesign = useDesignStore((state) => state.applyDesign);
  const bootstrap = useBootstrapDesign();
  const [showApplied, setShowApplied] = useState(false);

  const result = readAssessmentResult(rawResult);
  const activeBuild = useMemo(
    () => getActiveBuild(designSession),
    [designSession],
  );
  const tiles = useMemo(() => summaryTiles(activeBuild), [activeBuild]);

  useEffect(() => {
    if (!result || designSession || bootstrap.isPending) {
      return;
    }
    bootstrap.mutate({
      assessment: rawResult as Record<string, unknown>,
      property_ref:
        selectedProperty?.placeId ??
        selectedProperty?.address ??
        "session-property",
    });
  }, [
    bootstrap,
    designSession,
    rawResult,
    result,
    selectedProperty?.address,
    selectedProperty?.placeId,
  ]);

  if (!result) {
    return <Navigate to={ROUTE_PATHS.results} replace />;
  }

  const loading = bootstrap.isPending && !designSession;

  return (
    <>
      <FlowLayout
        step="Step 4 of 5 · AI design"
        title={
          <>
            Refine your <em className="font-normal italic">system design.</em>
          </>
        }
        backHref={ROUTE_PATHS.results}
        backLabel="Back to results"
        nextLabel="Apply design"
        nextDisabled={!designSession || loading}
        onNext={() => {
          applyDesign();
          setShowApplied(true);
        }}
        railClassName="lg:gap-4"
        lead={
          <>
            <DesignFlowStepper activeStep={4} />
            {activeBuild ? (
              <p className="font-sans text-sm text-secondary">
                {activeBuild.label} · {formatBuildInvestment(activeBuild)} · fit{" "}
                {activeBuild.fit_score.toFixed(0)}
              </p>
            ) : null}
          </>
        }
        pane={
          loading ? (
            <div className="flex h-full items-center justify-center font-sans text-secondary">
              Running the design solver…
            </div>
          ) : (
            <SystemCanvas build={activeBuild} session={designSession} />
          )
        }
      >
        <section
          aria-label="Summary tiles"
          className="rounded-[16px] border border-hairline bg-white p-3"
        >
          <Eyebrow>Active build</Eyebrow>
          <ul className="mt-3 flex flex-col gap-3">
            {tiles.map((tile) => (
              <li key={tile.label} className="flex flex-col gap-0.5">
                <span className="font-sans text-[10px] font-semibold tracking-[1px] text-tertiary uppercase">
                  {tile.label}
                </span>
                <span className="font-sans text-sm font-semibold text-ink">
                  {tile.value}
                </span>
                <span className="font-sans text-[12px] text-secondary">
                  {tile.detail}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <DesignSidebar
          onApplied={() => {
            applyDesign();
            setShowApplied(true);
          }}
        />

        {bootstrap.error ? (
          <p className="font-sans text-sm text-red-700" role="alert">
            {bootstrap.error.message}
          </p>
        ) : null}
      </FlowLayout>

      <DesignAppliedModal
        open={showApplied}
        onKeepEditing={() => setShowApplied(false)}
        systemKwp={activeBuild?.system_kwp}
        totalInvestmentPhp={activeBuild?.total_investment_php}
      />
    </>
  );
}
