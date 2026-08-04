import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import { ROUTE_PATHS } from "../../app/routePaths";
import { DesignFlowStepper } from "../../shared/components/layout";
import { readAssessmentResult } from "../assessment/formatAssessmentResult";
import { useAssessmentStore } from "../../state/assessmentStore";
import { useDesignStore } from "../../state/designStore";
import { DesignAppliedModal } from "./DesignAppliedModal";
import { DesignSidebar } from "./DesignSidebar";
import { DesignSummaryBar } from "./DesignSummaryBar";
import { SystemCanvas } from "./SystemCanvas";
import { getActiveBuild, summaryTiles } from "./designViewModel";
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
  const actionsDisabled = !designSession || loading;

  const handleApply = () => {
    applyDesign();
    setShowApplied(true);
  };

  return (
    <>
      <main id="main" className="flex h-svh flex-col bg-paper">
        <header className="shrink-0 border-b border-hairline bg-paper px-4 pt-4 pb-3 lg:px-8 lg:pt-6">
          <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4">
            <Link
              to={ROUTE_PATHS.results}
              className="w-fit font-sans text-sm font-semibold text-cobalt hover:underline"
            >
              ← Back to results
            </Link>

            <div className="flex justify-center overflow-x-auto">
              <DesignFlowStepper activeStep={4} />
            </div>
          </div>
        </header>

        <DesignSummaryBar
          tiles={tiles}
          applyDisabled={actionsDisabled}
          saveDisabled={actionsDisabled}
          onApply={handleApply}
        />

        <div className="mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 flex-col lg:grid lg:grid-cols-[22rem_1fr]">
          <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto border-b border-hairline px-4 py-5 lg:border-r lg:border-b-0 lg:px-6 lg:py-6">
            <DesignSidebar />

            {bootstrap.error ? (
              <p className="font-sans text-sm text-ember" role="alert">
                {bootstrap.error.message}
              </p>
            ) : null}
          </aside>

          <section className="flex min-h-0 flex-1 flex-col px-4 py-5 lg:px-8 lg:py-6">
            {loading ? (
              <div className="flex h-full items-center justify-center font-sans text-secondary">
                Running the design solver…
              </div>
            ) : (
              <SystemCanvas build={activeBuild} session={designSession} />
            )}
          </section>
        </div>
      </main>

      <DesignAppliedModal
        open={showApplied}
        onKeepEditing={() => setShowApplied(false)}
        systemKwp={activeBuild?.system_kwp}
        totalInvestmentPhp={activeBuild?.total_investment_php}
      />
    </>
  );
}
