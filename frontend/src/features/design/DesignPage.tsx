import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";

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
    if (
      !result ||
      designSession ||
      bootstrap.isPending ||
      bootstrap.isError
    ) {
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
    bootstrap.isError,
    bootstrap.isPending,
    bootstrap.mutate,
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
        <header className="shrink-0 bg-paper pt-5 pb-4">
          <div className="mx-auto flex w-full max-w-[1440px] justify-center overflow-x-auto px-4 lg:px-8">
            <DesignFlowStepper activeStep={4} />
          </div>
        </header>

        <DesignSummaryBar
          tiles={tiles}
          applyDisabled={actionsDisabled}
          saveDisabled={actionsDisabled}
          onApply={handleApply}
        />

        <div className="mx-auto grid min-h-0 w-full max-w-[1440px] flex-1 grid-cols-1 lg:grid-cols-[18.5rem_1fr]">
          <aside className="flex min-h-0 flex-col overflow-hidden border-b border-hairline px-5 py-5 lg:border-r lg:border-b-0 lg:px-5">
            <DesignSidebar />

            {bootstrap.error ? (
              <p className="mt-4 font-sans text-sm text-ember" role="alert">
                {bootstrap.error.message}
              </p>
            ) : null}
          </aside>

          <section className="min-h-0 p-4 lg:p-6">
            {loading ? (
              <div className="flex h-full min-h-[28rem] items-center justify-center rounded-[20px] border border-hairline bg-[#fcfaf5] font-sans text-secondary">
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
