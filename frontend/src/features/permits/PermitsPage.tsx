// Defines the D6 permits step, now the last step in the pipeline
// (quotation -> brief -> permits). Live data replaces the
// `/permits-preview` fixture: property address
// and system size come from the assessment/design session, and the checklist
// is the real POST /permits/assess response — the domain computes, this page
// only renders it (AGENTS.md rule 1). Documents uploaded here are resent on
// every assess call, same as the chat endpoint, since the backend keeps no
// session store.
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { ROUTE_PATHS } from "../../app/routePaths";
import {
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  shrinkImageForUpload,
} from "../../shared/lib/uploadFiles";
import { DesignFlowStepper } from "../../shared/components/layout/DesignFlowStepper";
import { Button, Eyebrow, Rule } from "../../shared/components/ui";
import { useAssessmentStore } from "../../state/assessmentStore";
import { useDesignStore } from "../../state/designStore";
import { getActiveBuild } from "../design/designViewModel";
import { ApplicantForm, type ApplicantFormValues } from "./ApplicantForm";
import { DocumentChecklist } from "./DocumentChecklist";
import { PacketStatusCard } from "./PacketStatusCard";
import { PermitChatSidebar } from "./PermitChatSidebar";
import { PermitsList } from "./PermitsList";
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
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Files the backend has already read. Later requests send the documents it
  // returned instead, so each file is uploaded and read once.
  const [sentFiles, setSentFiles] = useState<ReadonlySet<File>>(() => new Set());
  const [lastAssessment, setLastAssessment] = useState<PermitAssessment | null>(null);
  const [egovAcknowledged, setEgovAcknowledged] = useState(false);
  const [isStartingOver, setIsStartingOver] = useState(false);
  const assess = useAssessPermit();

  const propertyAddress = selectedProperty?.address ?? "";
  const systemKwp = activeBuild?.system_kwp ?? 0;
  const buildId = activeBuild?.id ?? null;

  const unsentUploads = (all: ReadonlyMap<string, File>) =>
    new Map([...all].filter(([, file]) => !sentFiles.has(file)));

  const markSent = (sent: ReadonlyMap<string, File>) => {
    setSentFiles((current) => new Set([...current, ...sent.values()]));
  };

  useEffect(() => {
    if (!submittedApplicant || !buildId || !propertyAddress) {
      return;
    }
    const pending = unsentUploads(uploads);
    assess.mutate(
      {
        applicant: submittedApplicant,
        systemKwp,
        buildId,
        propertyAddress,
        extractedDocuments: lastAssessment?.extracted_documents ?? [],
        uploads: pending,
      },
      {
        onSuccess: (assessment) => {
          markSent(pending);
          setLastAssessment(assessment);
        },
      },
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

  // Assess and chat both re-send every document in one request, so the limit
  // applies to the whole packet, not to each file on its own.
  const handleUpload = async (documentId: string, original: File) => {
    const file = await shrinkImageForUpload(original);
    const next = new Map(uploads).set(documentId, file);
    const packetBytes = [...next.values()].reduce((total, item) => total + item.size, 0);
    if (packetBytes > MAX_UPLOAD_BYTES) {
      setUploadError(
        `${original.name} would take your documents over ${MAX_UPLOAD_LABEL} in total. Upload a smaller photo or a PDF.`,
      );
      return;
    }
    setUploadError(null);
    setUploads(next);
  };

  const handleApplicantChange = (next: ApplicantFormValues) => {
    setApplicant(next);
  };

  const handleApplicantSubmit = () => {
    setSubmittedApplicant(applicant);
  };

  // Chat confirms applicant changes itself (the reply already carries a
  // recomputed assessment) and only calls back when the values actually
  // changed, so treat them as submitted too. Otherwise the next document
  // upload re-triggers the assess effect with the pre-chat snapshot and
  // silently reverts the correction (PR #32 review).
  const handleChatAssessmentChange = (
    assessment: PermitAssessment,
    nextApplicant: ApplicantFormValues,
  ) => {
    // The turn carried every unsent file, and its assessment holds them now.
    markSent(unsentUploads(uploads));
    setLastAssessment(assessment);
    // A Q&A-only chat turn still produces a real assessment — wire it into
    // the assess pipeline so later document uploads re-check the packet.
    setSubmittedApplicant((current) => current ?? nextApplicant);
  };

  const handleChatApplicantChange = (next: ApplicantFormValues) => {
    setApplicant(next);
    setSubmittedApplicant(next);
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

        {uploadError ? (
          <p className="font-sans text-sm text-ember" role="alert">
            {uploadError}
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
                <PermitsList assessment={assessment} />
                <Rule />
                <DocumentChecklist
                  assessment={assessment}
                  sessionUploads={new Set(uploads.keys())}
                  onUpload={(documentId, file) => void handleUpload(documentId, file)}
                />
                <Rule />
                <PacketStatusCard
                  assessment={assessment}
                  onSubmit={() => setEgovAcknowledged(true)}
                  submitAcknowledged={egovAcknowledged}
                />
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
              onApplicantChange={handleChatApplicantChange}
              onAssessmentChange={handleChatAssessmentChange}
              propertyAddress={propertyAddress}
              systemKwp={systemKwp}
              uploads={unsentUploads(uploads)}
              extractedDocuments={lastAssessment?.extracted_documents ?? []}
              buildId={buildId}
            />
          </aside>
        </div>
      </main>
    </div>
  );
}
