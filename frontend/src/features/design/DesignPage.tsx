import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";

import { ROUTE_PATHS } from "../../app/routePaths";
import {
  DesignFlowStepper,
  DesignStepTabs,
  StepPageHeader,
} from "../../shared/components/layout";
import { readAssessmentResult } from "../assessment/formatAssessmentResult";
import { buildPlansPayload } from "../assessment/buildPlansPayload";
import { useAssessmentStore } from "../../state/assessmentStore";
import { useDesignStore } from "../../state/designStore";
import { DesignAppliedModal } from "./DesignAppliedModal";
import { DesignSidebar } from "./DesignSidebar";
import { DesignSummaryBar } from "./DesignSummaryBar";
import { SystemCanvas } from "./SystemCanvas";
import {
  getActiveBuild,
  formatBuildInvestment,
  summaryTiles,
} from "./designViewModel";
import { useBootstrapDesign } from "./useDesignActions";

export function DesignPage() {
  const rawResult = useAssessmentStore((state) => state.result);
  const selectedProperty = useAssessmentStore(
    (state) => state.selectedProperty,
  );
  const plans = useAssessmentStore((state) => state.plans);
  const designSession = useDesignStore((state) => state.designSession);
  const quoteAuditResults = useDesignStore((state) => state.quoteAuditResults);
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
    if (!result || designSession || bootstrap.isPending || bootstrap.isError) {
      return;
    }
    bootstrap.mutate({
      assessment: rawResult as Record<string, unknown>,
      property_ref:
        selectedProperty?.placeId ??
        selectedProperty?.address ??
        "session-property",
      plans: buildPlansPayload(plans),
    });
  }, [
    bootstrap.isError,
    bootstrap.isPending,
    bootstrap.mutate,
    designSession,
    plans,
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
      <main id="main" className="flex min-h-svh flex-col bg-paper">
        <div className="mx-auto flex w-full max-w-[1440px] shrink-0 flex-col gap-6 px-4 pt-6 pb-5 sm:px-6 lg:px-16 lg:pt-8">
          <div className="flex w-full flex-col gap-4 overflow-x-auto">
            <div className="flex sm:justify-center">
              <DesignFlowStepper activeStep={4} />
            </div>
            <DesignStepTabs />
          </div>

          <StepPageHeader
            backHref={ROUTE_PATHS.results}
            backLabel="Back to your results"
            eyebrow="Step 4 of 6 · AI design"
            title={
              <>
                Shape your <em className="font-normal italic">system.</em>
              </>
            }
            lead={
              activeBuild &&
              Math.abs(
                activeBuild.system_kwp -
                  Number(result.recommendation.system_capacity_kwp),
              ) >= 0.05 ? (
                <p>
                  Starting from your {result.recommendation.panel_count}-panel
                  preliminary estimate (
                  {Number(result.recommendation.system_capacity_kwp).toFixed(1)}{" "}
                  kWp). Selected catalog equipment sizes the system at{" "}
                  {activeBuild.system_kwp.toFixed(1)} kWp.
                </p>
              ) : null
            }
            actions={
              <DesignSummaryBar
                tiles={tiles}
                applyDisabled={actionsDisabled}
                saveDisabled={actionsDisabled}
                onApply={handleApply}
              />
            }
          />
        </div>

        <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 px-4 pb-6 sm:px-6 lg:h-[40rem] lg:grid-cols-[19rem_1fr] lg:px-16 lg:pb-6">
          <aside className="order-2 flex h-[34rem] min-h-0 flex-col overflow-hidden border-t border-hairline py-5 lg:order-none lg:h-auto lg:border-t-0 lg:pr-2">
            <DesignSidebar />

            {bootstrap.error ? (
              <p className="mt-4 font-sans text-sm text-ember" role="alert">
                {bootstrap.error.message}
              </p>
            ) : null}
          </aside>

          <section className="min-h-0 py-4 lg:py-0 lg:pl-6">
            {loading ? (
              <div className="flex h-full min-h-[28rem] items-center justify-center rounded-[20px] border border-hairline bg-[#fcfaf5] font-sans text-secondary">
                Running the design solver…
              </div>
            ) : (
              <SystemCanvas
                build={activeBuild}
                session={designSession}
                quoteResults={quoteAuditResults}
              />
            )}
          </section>
        </div>
      </main>

      <DesignAppliedModal
        open={showApplied}
        onKeepEditing={() => setShowApplied(false)}
        systemKwp={activeBuild?.system_kwp}
        totalInvestmentLabel={
          activeBuild ? formatBuildInvestment(activeBuild) : undefined
        }
      />
    </>
  );
}
