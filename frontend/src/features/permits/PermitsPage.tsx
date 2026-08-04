// Defines the D6 permits step, wired into the design flow after Quotation
// (T3b). Live data replaces the `/permits-preview` fixture: property address
// and system size come from the assessment/design session, and the checklist
// is the real POST /permits/assess response — the domain computes, this page
// only renders it (AGENTS.md rule 1). Documents uploaded here are resent on
// every assess call, same as the chat endpoint, since the backend keeps no
// session store.
import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";

import { ROUTE_PATHS } from "../../app/routePaths";
import { DesignFlowStepper } from "../../shared/components/layout/DesignFlowStepper";
import { ButtonLink, Eyebrow, Rule } from "../../shared/components/ui";
import { useAssessmentStore } from "../../state/assessmentStore";
import { useDesignStore } from "../../state/designStore";
import { getActiveBuild } from "../design/designViewModel";
import { ApplicantForm, type ApplicantFormValues } from "./ApplicantForm";
import { DocumentChecklist } from "./DocumentChecklist";
import { PacketStatusCard } from "./PacketStatusCard";
import { PermitChatSidebar } from "./PermitChatSidebar";
import { VerdictBanner } from "./VerdictBanner";
import { chatOpeningMessages } from "./permitsViewModel";
import { useAssessPermit } from "./useAssessPermit";

const DEFAULT_APPLICANT: ApplicantFormValues = {
  solarInOriginalPermit: "not_sure",
  fullName: "",
  isRegisteredOwner: "yes",
  registeredOwnerName: "",
};

// Debounces re-assessment while the homeowner is still typing a name — every
// keystroke would otherwise fire a request.
const ASSESS_DEBOUNCE_MS = 500;

export function PermitsPage() {
  const selectedProperty = useAssessmentStore((state) => state.selectedProperty);
  const designSession = useDesignStore((state) => state.designSession);
  const activeBuild = getActiveBuild(designSession);

  const [applicant, setApplicant] = useState<ApplicantFormValues>(DEFAULT_APPLICANT);
  const [uploads, setUploads] = useState<ReadonlyMap<string, File>>(() => new Map());
  const assess = useAssessPermit();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const propertyAddress = selectedProperty?.address ?? "";
  const systemKwp = activeBuild?.system_kwp ?? 0;
  const buildId = activeBuild?.id ?? null;

  useEffect(() => {
    if (!buildId || !propertyAddress) {
      return;
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      assess.mutate({ applicant, systemKwp, buildId, propertyAddress, uploads });
    }, ASSESS_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
    // assess and assess.mutate are stable across renders (react-query); only
    // the request's own inputs should re-trigger the debounce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicant, uploads, buildId, propertyAddress, systemKwp]);

  if (!designSession || !activeBuild) {
    return <Navigate to={ROUTE_PATHS.compare} replace />;
  }
  if (!selectedProperty) {
    return <Navigate to={ROUTE_PATHS.locate} replace />;
  }

  const handleUpload = (documentId: string, file: File) => {
    setUploads((current) => new Map(current).set(documentId, file));
  };

  const assessment = assess.data ?? null;

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
              onChange={setApplicant}
              propertyAddress={propertyAddress}
            />

            {assessment ? (
              <>
                <Rule />
                <DocumentChecklist
                  assessment={assessment}
                  sessionUploads={new Set(uploads.keys())}
                  onUpload={handleUpload}
                />
                <Rule />
                <PacketStatusCard assessment={assessment} />
                <ButtonLink to={ROUTE_PATHS.brief} fullWidth>
                  Start saving with solar
                </ButtonLink>
              </>
            ) : (
              <p className="font-sans text-sm text-secondary">
                {assess.isPending
                  ? "Checking your packet…"
                  : "Confirm your details above to see which documents you need."}
              </p>
            )}
          </div>

          <aside className="xl:sticky xl:top-6 xl:h-[calc(100svh-3rem)]">
            <PermitChatSidebar
              applicant={applicant}
              onApplicantChange={setApplicant}
              propertyAddress={propertyAddress}
              systemKwp={systemKwp}
              openingMessages={assessment ? chatOpeningMessages(assessment, false) : []}
            />
          </aside>
        </div>
      </main>
    </div>
  );
}
