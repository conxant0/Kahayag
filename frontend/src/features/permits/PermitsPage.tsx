// Defines the D6 permits step, now the last step in the pipeline
// (quotation -> brief -> report -> permits). Live data replaces the
// `/permits-preview` fixture: property address
// and system size come from the assessment/design session, and the checklist
// is the real POST /permits/assess response — the domain computes, this page
// only renders it (AGENTS.md rule 1). Documents uploaded here are resent on
// every assess call, same as the chat endpoint, since the backend keeps no
// session store.
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { ROUTE_PATHS } from "../../app/routePaths";
import { DesignFlowStepper } from "../../shared/components/layout/DesignFlowStepper";
import { Button, Eyebrow, Rule } from "../../shared/components/ui";
import { useAssessmentStore } from "../../state/assessmentStore";
import { useDesignStore } from "../../state/designStore";
import { getActiveBuild } from "../design/designViewModel";
import { ApplicantForm, type ApplicantFormValues } from "./ApplicantForm";
import { DocumentChecklist } from "./DocumentChecklist";
import { PacketStatusCard } from "./PacketStatusCard";
import { PermitChatSidebar } from "./PermitChatSidebar";
import { VerdictBanner } from "./VerdictBanner";
import { useAssessPermit } from "./useAssessPermit";
import type { PermitAssessment } from "./permitTypes";

const DEFAULT_APPLICANT: ApplicantFormValues = {
  solarInOriginalPermit: "not_sure",
  fullName: "",
  isRegisteredOwner: "yes",
  registeredOwnerName: "",
  delegatesFilingToRepresentative: false,
};

export function PermitsPage() {
  const selectedProperty = useAssessmentStore((state) => state.selectedProperty);
  const resetAssessment = useAssessmentStore((state) => state.reset);
  const designSession = useDesignStore((state) => state.designSession);
  const activeBuild = getActiveBuild(designSession);

  const [applicant, setApplicant] = useState<ApplicantFormValues>(DEFAULT_APPLICANT);
  const [submittedApplicant, setSubmittedApplicant] = useState<ApplicantFormValues | null>(null);
  const [uploads, setUploads] = useState<ReadonlyMap<string, File>>(() => new Map());
  const [lastAssessment, setLastAssessment] = useState<PermitAssessment | null>(null);
  const [egovAcknowledged, setEgovAcknowledged] = useState(false);
  const [isStartingOver, setIsStartingOver] = useState(false);
  const assess = useAssessPermit();

  const propertyAddress = selectedProperty?.address ?? "";
  const systemKwp = activeBuild?.system_kwp ?? 0;
  const buildId = activeBuild?.id ?? null;

  useEffect(() => {
    if (!submittedApplicant || !buildId || !propertyAddress) {
      return;
    }
    assess.mutate(
      { applicant: submittedApplicant, systemKwp, buildId, propertyAddress, uploads },
      { onSuccess: setLastAssessment },
    );
    // assess and assess.mutate are stable across renders (react-query); only
    // the request's own inputs should re-trigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submittedApplicant, uploads, buildId, propertyAddress, systemKwp]);

  if (isStartingOver) {
    return <Navigate to={ROUTE_PATHS.landing} replace />;
  }

  if (!designSession || !activeBuild) {
    return <Navigate to={ROUTE_PATHS.compare} replace />;
  }
  if (!selectedProperty) {
    return <Navigate to={ROUTE_PATHS.locate} replace />;
  }

  const handleUpload = (documentId: string, file: File) => {
    setUploads((current) => new Map(current).set(documentId, file));
  };

  const handleApplicantChange = (next: ApplicantFormValues) => {
    setApplicant(next);
  };

  const handleApplicantSubmit = () => {
    setSubmittedApplicant(applicant);
  };

  const assessment = lastAssessment;

  return (
    <div className="flex min-h-svh flex-col bg-paper">
      <main
        id="main"
        className="mx-auto flex w-full max-w-[1240px] flex-col gap-7 px-6 pt-8 pb-16 lg:gap-8 lg:px-10 lg:pt-10"
      >
        <DesignFlowStepper activeStep={6} />

        <header>
          <Eyebrow>Permits &amp; compliance</Eyebrow>
          <h1 className="mt-2 font-serif text-[36px] leading-tight font-medium text-balance text-ink lg:text-[44px]">
            Homeowner permit packet
          </h1>
          <p className="mt-3 max-w-2xl font-sans text-sm leading-6 text-secondary">
            This screen only covers documents you can produce yourself.
            Installer and licensed-professional filings are handled
            separately.
          </p>
        </header>

        <Rule />

        {assess.error ? (
          <p className="font-sans text-sm text-ember" role="alert">
            {assess.error.message}
          </p>
        ) : null}

        <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start xl:gap-12">
          <div className="flex flex-col gap-7 lg:gap-8">
            {assessment ? <VerdictBanner assessment={assessment} /> : null}

            <Rule />

            <ApplicantForm
              values={applicant}
              onChange={handleApplicantChange}
              onSubmit={handleApplicantSubmit}
              propertyAddress={propertyAddress}
            />

            {assessment ? (
              <>
                <Rule />
                {assess.isPending ? (
                  <p className="font-sans text-xs text-tertiary-ink">
                    Re-checking…
                  </p>
                ) : null}
                <DocumentChecklist
                  assessment={assessment}
                  sessionUploads={new Set(uploads.keys())}
                  onUpload={handleUpload}
                />
                <Rule />
                <PacketStatusCard assessment={assessment} />
                {assessment.packet_status === "ready" ? (
                  <Button
                    fullWidth
                    onClick={() => setEgovAcknowledged(true)}
                  >
                    Submit to eGov
                  </Button>
                ) : null}
                {egovAcknowledged ? (
                  <Button
                    variant="ghost"
                    fullWidth
                    onClick={() => {
                      setIsStartingOver(true);
                      resetAssessment();
                    }}
                  >
                    Start another assessment
                  </Button>
                ) : null}
              </>
            ) : (
              <p className="font-sans text-sm text-secondary">
                {assess.isPending
                  ? "Checking your packet…"
                  : "Submit your details above to see which documents you need."}
              </p>
            )}
          </div>

          <aside className="xl:sticky xl:top-6 xl:h-[calc(100svh-3rem)]">
            <PermitChatSidebar
              applicant={applicant}
              onApplicantChange={handleApplicantChange}
              onAssessmentChange={setLastAssessment}
              propertyAddress={propertyAddress}
              systemKwp={systemKwp}
              uploads={uploads}
              buildId={buildId}
            />
          </aside>
        </div>
      </main>
    </div>
  );
}
