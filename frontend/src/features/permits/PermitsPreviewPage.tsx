// Defines the standalone permits preview route (`/permits-preview`, T3a-v2).
// Fixture-driven except the chat sidebar, which calls the real
// POST /permits/chat (T4). Kept as a scenario-toggle demo for design review;
// the wired D6 step homeowners actually go through is PermitsPage.tsx, linked
// from Quotation and on the DesignFlowStepper (T3b).
//
// Laid out in the flat editorial system: paper ground, hairline rules between
// blocks, no card shells — the same language as ContentScreen, kept as a
// custom grid so the chat sidebar can stay sticky and full height.
//
// Presentation decisions settled after side-by-side comparison (user call):
// findings render inline on their checklist rows (the chat opens with just
// the summary), and the page runs the "focus" layout — verdict and hand-off
// keep only their essential copy, the answered form rests as a summary line,
// checklist rows carry a single Details disclosure, the uploaded group folds
// to a count, and the office run lists only outstanding stops.
import { useMemo, useState } from "react";

import { Eyebrow, Rule, SegmentedToggle } from "../../shared/components/ui";
import { ApplicantForm, type ApplicantFormValues } from "./ApplicantForm";
import { DocumentChecklist } from "./DocumentChecklist";
import { PacketStatusCard } from "./PacketStatusCard";
import { PermitChatSidebar } from "./PermitChatSidebar";
import { PermitsList } from "./PermitsList";
import { VerdictBanner } from "./VerdictBanner";
import {
  MOCK_PROPERTY_ADDRESS,
  PERMIT_ASSESSMENT_SCENARIOS,
  type PermitAssessmentScenario,
} from "./fixtures/mockPermitAssessments";
import { deriveAssessment } from "./permitsViewModel";

const SCENARIO_OPTIONS = [
  { value: "incomplete" as PermitAssessmentScenario, label: "Incomplete packet" },
  { value: "complete" as PermitAssessmentScenario, label: "Complete packet" },
];

// This fixture-driven preview has no real uploads for the chat to ground on
// — a stable empty map so it isn't a new object identity every render.
const NO_UPLOADS: ReadonlyMap<string, File> = new Map();

const DEFAULT_APPLICANT: ApplicantFormValues = {
  solarInOriginalPermit: "not_sure",
  fullName: "Maria Cruz Santos-Reyes",
  isRegisteredOwner: "no",
  registeredOwnerName: "Juan Cruz Santos",
  delegatesFilingToRepresentative: false,
};

function PreviewControl({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-sans text-[11px] font-semibold tracking-[0.8px] text-tertiary-ink uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}

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

  const handleUpload = (documentId: string) => {
    setSessionUploads((current) => new Set(current).add(documentId));
  };

  // Resets per-scenario demo state so switching scenarios doesn't carry
  // stale "uploaded this session" statuses across fixtures.
  const handleScenarioChange = (next: PermitAssessmentScenario) => {
    setScenario(next);
    setSessionUploads(new Set());
  };

  return (
    <div className="flex min-h-svh flex-col bg-paper">
      <main
        id="main"
        className="mx-auto flex w-full max-w-[1240px] flex-col gap-7 px-6 pt-8 pb-16 lg:gap-8 lg:px-10 lg:pt-10"
      >
        <header className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
          <div>
            <p className="font-sans text-[11px] font-semibold tracking-[1.4px] text-tertiary-ink uppercase">
              Preview — not wired into the assessment flow
            </p>
            <Eyebrow className="mt-5">Permits &amp; compliance</Eyebrow>
            <h1 className="mt-2 font-serif text-[36px] leading-tight font-medium text-balance text-ink lg:text-[44px]">
              Homeowner permit packet
            </h1>
            <p className="mt-3 max-w-2xl font-sans text-sm leading-6 text-secondary">
              This screen only covers documents you can produce yourself.
              Installer and licensed-professional filings are handled
              separately.
            </p>
          </div>
          <PreviewControl label="Fixture state">
            <SegmentedToggle
              ariaLabel="Fixture scenario"
              value={scenario}
              options={SCENARIO_OPTIONS}
              onChange={handleScenarioChange}
            />
          </PreviewControl>
        </header>

        <Rule />

        <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start xl:gap-12">
          <div className="flex flex-col gap-7 lg:gap-8">
            <VerdictBanner assessment={assessment} />

            <Rule />

            <ApplicantForm
              values={applicant}
              onChange={setApplicant}
              propertyAddress={MOCK_PROPERTY_ADDRESS}
            />

            <Rule />

            <PermitsList assessment={assessment} />

            <Rule />

            <DocumentChecklist
              assessment={assessment}
              sessionUploads={sessionUploads}
              onUpload={handleUpload}
            />

            <Rule />

            <PacketStatusCard assessment={assessment} />
          </div>

          <aside className="xl:sticky xl:top-6 xl:h-[calc(100svh-3rem)]">
            <PermitChatSidebar
              applicant={applicant}
              onApplicantChange={setApplicant}
              // This preview stays fixture-driven: the chat's `assessment` is
              // real backend output against a different document catalog
              // than this page's fixture, so it isn't applied here — only
              // the wired D6 step (PermitsPage.tsx) renders it.
              onAssessmentChange={() => {}}
              propertyAddress={MOCK_PROPERTY_ADDRESS}
              systemKwp={baseAssessment.net_metering_eligibility.system_kwp}
              uploads={NO_UPLOADS}
              buildId={null}
            />
          </aside>
        </div>
      </main>
    </div>
  );
}
