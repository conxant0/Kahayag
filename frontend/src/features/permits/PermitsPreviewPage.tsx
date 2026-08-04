// Defines the standalone permits preview route (`/permits-preview`, T3a-v2).
// Fixture-driven except the chat sidebar, which calls the real
// POST /permits/chat (T4). Not linked from Quotation, not added to
// DesignFlowStepper — that is T3b, gated on user approval.
import { useMemo, useState } from "react";

import { Eyebrow, SegmentedToggle } from "../../shared/components/ui";
import { ApplicantForm, type ApplicantFormValues } from "./ApplicantForm";
import { DocumentChecklist } from "./DocumentChecklist";
import { FindingsPanel } from "./FindingsPanel";
import { PacketStatusCard } from "./PacketStatusCard";
import { PermitChatSidebar } from "./PermitChatSidebar";
import { VerdictBanner } from "./VerdictBanner";
import {
  MOCK_PROPERTY_ADDRESS,
  PERMIT_ASSESSMENT_SCENARIOS,
  type PermitAssessmentScenario,
} from "./fixtures/mockPermitAssessments";
import { deriveAssessment, progressSummary } from "./permitsViewModel";

const SCENARIO_OPTIONS = [
  { value: "incomplete" as PermitAssessmentScenario, label: "Incomplete packet" },
  { value: "complete" as PermitAssessmentScenario, label: "Complete packet" },
];

const DEFAULT_APPLICANT: ApplicantFormValues = {
  solarInOriginalPermit: "not_sure",
  fullName: "Maria Cruz Santos-Reyes",
  isRegisteredOwner: "no",
  registeredOwnerName: "Juan Cruz Santos",
};

export function PermitsPreviewPage() {
  const [scenario, setScenario] = useState<PermitAssessmentScenario>("incomplete");
  const [applicant, setApplicant] = useState<ApplicantFormValues>(DEFAULT_APPLICANT);
  const [sessionUploads, setSessionUploads] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const baseAssessment = PERMIT_ASSESSMENT_SCENARIOS[scenario];
  // The form (track answer, registered-owner answer) and this session's
  // uploads re-derive which documents are required and their statuses on
  // every render — the fixture no longer drives the checklist on its own
  // (item 2 & 4).
  const assessment = useMemo(
    () => deriveAssessment(baseAssessment, applicant, sessionUploads),
    [baseAssessment, applicant, sessionUploads],
  );
  const progress = progressSummary(assessment);

  const handleUpload = (documentId: string) => {
    setSessionUploads((current) => new Set(current).add(documentId));
  };

  // Resets per-scenario demo state so switching scenarios doesn't carry
  // stale "uploaded this session" pills across fixtures.
  const handleScenarioChange = (next: PermitAssessmentScenario) => {
    setScenario(next);
    setSessionUploads(new Set());
  };

  return (
    <div className="flex min-h-svh flex-col bg-[#f4f1ea]">
      <main
        id="main"
        className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 pt-6 pb-16 lg:gap-8 lg:px-10 lg:pt-10"
      >
        <header>
          <span className="rounded-pill bg-[#fff4cc] px-3 py-1 font-sans text-[11px] font-semibold text-[#7a5c00]">
            Preview only — not wired into the assessment flow
          </span>
          <Eyebrow className="mt-4">Permits & compliance</Eyebrow>
          <h1 className="mt-2 font-serif text-[32px] font-medium leading-none text-ink lg:text-[38px]">
            Homeowner permit packet
          </h1>
          <p className="mt-2 max-w-2xl font-sans text-sm leading-6 text-secondary">
            This screen only covers documents you can produce yourself.
            Installer and licensed-professional filings are handled
            separately.
          </p>
        </header>

        <div className="flex flex-wrap items-center gap-3">
          <span className="font-sans text-[11px] font-semibold tracking-[0.8px] text-tertiary uppercase">
            Fixture state
          </span>
          <SegmentedToggle
            ariaLabel="Fixture scenario"
            value={scenario}
            options={SCENARIO_OPTIONS}
            onChange={handleScenarioChange}
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
          <div className="flex flex-col gap-6 lg:gap-8">
            <VerdictBanner assessment={assessment} />

            <section
              aria-label="Progress"
              className="rounded-[20px] border border-hairline bg-white p-5 lg:p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-sans text-[11px] font-semibold tracking-[1.4px] text-tertiary-ink uppercase">
                  Your side of the paperwork
                </p>
                <p className="font-sans text-[13px] font-semibold text-ink">
                  {progress.resolved} of {progress.total} resolved
                </p>
              </div>
              <div
                role="progressbar"
                aria-label="Documents resolved"
                aria-valuemin={0}
                aria-valuemax={progress.total}
                aria-valuenow={progress.resolved}
                className="mt-3 h-2 w-full overflow-hidden rounded-pill bg-[#f2eee4]"
              >
                <div
                  className="h-full rounded-pill bg-cobalt transition-[width] duration-200 ease-brand"
                  style={{ width: `${Math.round(progress.ratio * 100)}%` }}
                />
              </div>
            </section>

            <ApplicantForm
              values={applicant}
              onChange={setApplicant}
              propertyAddress={MOCK_PROPERTY_ADDRESS}
            />

            <DocumentChecklist
              assessment={assessment}
              sessionUploads={sessionUploads}
              onUpload={handleUpload}
            />

            <FindingsPanel assessment={assessment} />

            <PacketStatusCard assessment={assessment} />
          </div>

          <aside className="flex flex-col gap-4 xl:sticky xl:top-6 xl:h-[calc(100svh-3rem)]">
            <PermitChatSidebar
              applicant={applicant}
              onApplicantChange={setApplicant}
              propertyAddress={MOCK_PROPERTY_ADDRESS}
              systemKwp={baseAssessment.net_metering_eligibility.system_kwp}
            />
          </aside>
        </div>
      </main>
    </div>
  );
}
