// Defines the standalone permits preview route (`/permits-preview`, T3a).
// Driven entirely by the mock fixture — not the live endpoint, not linked
// from Quotation, not added to DesignFlowStepper. That is T3b, gated on
// user approval.
import { useState } from "react";

import { Eyebrow, SegmentedToggle } from "../../shared/components/ui";
import { ApplicantForm, type ApplicantFormValues } from "./ApplicantForm";
import { DocumentChecklist } from "./DocumentChecklist";
import { FindingsPanel } from "./FindingsPanel";
import { PacketStatusCard } from "./PacketStatusCard";
import { VerdictBanner } from "./VerdictBanner";
import {
  MOCK_PROPERTY_ADDRESS,
  PERMIT_ASSESSMENT_SCENARIOS,
  type PermitAssessmentScenario,
} from "./fixtures/mockPermitAssessments";

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

  const assessment = PERMIT_ASSESSMENT_SCENARIOS[scenario];

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
        className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 pt-6 pb-16 lg:gap-8 lg:px-10 lg:pt-10"
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

        <VerdictBanner assessment={assessment} />

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
      </main>
    </div>
  );
}
