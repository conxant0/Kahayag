import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";

import { ROUTE_PATHS } from "../../app/routePaths";
import { FlowLayout } from "../../shared/components/layout";
import { Eyebrow, HairlineList, HairlineRow } from "../../shared/components/ui";
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
          activeBuild ? (
            <p className="font-sans text-sm text-secondary">
              {activeBuild.label} · {formatBuildInvestment(activeBuild)} · fit{" "}
              {activeBuild.fit_score.toFixed(0)}
            </p>
          ) : null
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
        <section aria-label="Summary tiles">
          <Eyebrow>Active build</Eyebrow>
          <HairlineList>
            {tiles.map((tile) => (
              <HairlineRow
                key={tile.label}
                label={tile.label}
                value={
                  <>
                    {tile.value}
                    <span className="block text-sm font-normal text-secondary">
                      {tile.detail}
                    </span>
                  </>
                }
              />
            ))}
          </HairlineList>
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
      />
    </>
  );
}
