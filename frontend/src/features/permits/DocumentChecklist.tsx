// Defines the document checklist: one row per required document, each with
// its own upload slot (CLOSED-doc-slots.md — the slot itself tells us what a
// file is, no AI classification). Hairline-separated rows in the HairlineList
// idiom, grouped into "still needs you" ahead of a collapsed "uploaded"
// count — resolved rows drop to 70% opacity so the remaining work carries
// the visual weight. Status colour follows the brandbook: cobalt informs
// (uploaded), ember interrupts (flagged, needs review), tertiary rests
// (missing). Each document's findings render inline under its row, and a
// single "Details" disclosure per row carries the guidance (office, stop on
// the office run, validity, sourced how-to steps) plus the legal basis and
// extraction result. Layout settled on the "focus" variant after
// side-by-side comparison (user call).
//
// Office, steps, and prerequisites come straight off the assessment
// response (backend/app/domain/permits catalog, issue #37) — this component
// holds no step copy of its own. The office run derives its order from
// declared prerequisites (a document's stop never precedes an unmet
// prerequisite's), and is shown as a suggestion, never enforced: slots stay
// uploadable in any order. The section closes with the suggested office
// run, listing only stops that still have outstanding documents.
import { useRef, useState } from "react";

import { Button, Eyebrow } from "../../shared/components/ui";
import type {
  FindingSeverity,
  PermitAssessment,
  PermitDocumentChecklistItem,
} from "./permitTypes";
import {
  DOCUMENT_CATALOG,
  documentDisplayStatus,
  documentExtractionSummary,
  documentRowAnchor,
  documentStatusLabel,
  findingSeverityLabel,
  findingsForDocument,
  officeRunPosition,
  officeRunStops,
  unmetPrerequisites,
  type DocumentDisplayStatus,
} from "./permitsViewModel";

function UploadIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M12 16V5M12 5l-3.5 3.5M12 5l3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 18.5v1A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

const STATUS_CLASS: Record<DocumentDisplayStatus, string> = {
  missing: "text-tertiary-ink",
  uploaded: "text-cobalt",
  needs_review: "text-ember",
  flagged: "text-ember",
};

const SEVERITY_LABEL_CLASS: Record<FindingSeverity, string> = {
  blocking: "text-ember",
  warning: "text-ink",
  info: "text-tertiary-ink",
};

const DISCLOSURE_BUTTON_CLASS =
  "flex items-center gap-1.5 font-sans text-[13px] font-semibold text-cobalt hover:underline";

const DETAIL_TERM_CLASS =
  "text-[10px] font-semibold tracking-[0.8px] text-tertiary-ink uppercase";

/** Where this document falls on the office run, phrased for the row. */
function whenToGetIt(
  document: PermitDocumentChecklistItem,
  assessment: PermitAssessment,
  totalStops: number,
): string {
  const position = officeRunPosition(document.document_id, assessment);
  if (position === null) {
    return "No fixed stop — get it whenever suits you.";
  }
  return `Stop ${position} of ${totalStops} on the suggested office run.`;
}

function DocumentRow({
  document,
  assessment,
  uploadedInSession,
  onUpload,
  quiet,
  totalStops,
}: {
  document: PermitDocumentChecklistItem;
  assessment: PermitAssessment;
  uploadedInSession: boolean;
  onUpload: (file: File) => void;
  quiet: boolean;
  totalStops: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(false);
  const catalogEntry = DOCUMENT_CATALOG[document.document_id];
  const displayStatus = documentDisplayStatus(document, assessment.findings);
  const unmetPrereqs = unmetPrerequisites(document, assessment);
  const inlineFindings = findingsForDocument(
    assessment.findings,
    document.document_id,
  );

  return (
    <li
      id={documentRowAnchor(document.document_id)}
      className={`rounded-[12px] border p-4 ${
        displayStatus === "uploaded"
          ? "border-green-700/20 bg-[#f2faf4]"
          : "border-hairline"
      } ${
        quiet
          ? "opacity-70 transition-opacity duration-150 ease-brand hover:opacity-100 focus-within:opacity-100"
          : ""
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="font-sans text-sm font-semibold text-ink">{document.title}</p>
          {document.unverified ? (
            <p
              className="mt-0.5 font-sans text-xs font-semibold text-ember"
              title="This entry has not been independently confirmed against a primary source."
            >
              Unverified — confirm before relying on this
            </p>
          ) : null}
          {inlineFindings.map((finding) => (
            <p
              key={`${finding.category}-${finding.message}`}
              className={`mt-1.5 max-w-xl font-sans text-[13px] leading-5 ${
                finding.severity === "blocking" ? "text-ink" : "text-secondary"
              }`}
            >
              <span
                className={`mr-2 text-[10px] font-semibold tracking-[0.8px] uppercase ${SEVERITY_LABEL_CLASS[finding.severity]}`}
              >
                {findingSeverityLabel(finding.severity)}
              </span>
              {finding.message}
            </p>
          ))}
          <button
            type="button"
            className={`mt-1.5 ${DISCLOSURE_BUTTON_CLASS}`}
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
          >
            Details
            <span
              aria-hidden="true"
              className={`transition-transform duration-150 ease-brand ${expanded ? "rotate-90" : ""}`}
            >
              ›
            </span>
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span
            className={`font-sans text-[11px] font-semibold tracking-[0.8px] whitespace-nowrap uppercase ${STATUS_CLASS[displayStatus]}`}
          >
            {documentStatusLabel(displayStatus)}
          </span>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                onUpload(file);
                event.target.value = "";
              }
            }}
          />
          <Button variant="ghost" onClick={() => inputRef.current?.click()}>
            <UploadIcon />
            {uploadedInSession || document.status === "uploaded"
              ? "Replace"
              : "Upload"}
          </Button>
        </div>
      </div>

      {expanded ? (
        <dl className="mt-3 flex flex-col gap-2.5 border-l-2 border-hairline pl-4 font-sans text-[13px] leading-5">
          <div>
            <dt className={DETAIL_TERM_CLASS}>Where</dt>
            <dd className="mt-0.5 text-ink">{document.issuing_agency}</dd>
          </div>
          <div>
            <dt className={DETAIL_TERM_CLASS}>When</dt>
            <dd className="mt-0.5 text-ink">
              {whenToGetIt(document, assessment, totalStops)}
            </dd>
          </div>
          {unmetPrereqs.length > 0 ? (
            <div>
              <dt className={DETAIL_TERM_CLASS}>Before this</dt>
              <dd className="mt-0.5 text-ember">
                Get{" "}
                {unmetPrereqs.map((prereq, index) => (
                  <span key={prereq.documentId}>
                    {index > 0 ? " and " : null}
                    <a
                      href={`#${documentRowAnchor(prereq.documentId)}`}
                      className="underline underline-offset-2"
                    >
                      {prereq.title}
                    </a>
                  </span>
                ))}{" "}
                first.
              </dd>
            </div>
          ) : null}
          {catalogEntry?.validity_note ? (
            <div>
              <dt className={DETAIL_TERM_CLASS}>Validity</dt>
              <dd className="mt-0.5 text-ink">{catalogEntry.validity_note}</dd>
            </div>
          ) : null}
          {document.steps.length > 0 ? (
            <div>
              <dt className={DETAIL_TERM_CLASS}>Steps</dt>
              <dd className="mt-0.5">
                <ol className="flex list-decimal flex-col gap-1 pl-4 text-ink">
                  {document.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </dd>
            </div>
          ) : null}
          {catalogEntry ? (
            <div>
              <dt className={DETAIL_TERM_CLASS}>Legal basis</dt>
              <dd className="mt-0.5 text-ink">
                {catalogEntry.legal_basis}{" "}
                <a
                  href={catalogEntry.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cobalt underline underline-offset-2"
                >
                  Source
                </a>
              </dd>
            </div>
          ) : null}
          <div>
            <dt className={DETAIL_TERM_CLASS}>What we found</dt>
            <dd className="mt-0.5 text-ink">
              {documentExtractionSummary(document, assessment.findings)}
            </dd>
          </div>
        </dl>
      ) : null}
    </li>
  );
}

/**
 * The suggested office run: the sourced visiting order, listing only the
 * stops that still have outstanding documents. Disappears once every stop is
 * settled.
 */
function OfficeRunPlan({ assessment }: { assessment: PermitAssessment }) {
  const stops = officeRunStops(assessment)
    .map((stop) => ({
      ...stop,
      documents: stop.documents.filter((doc) => doc.status !== "uploaded"),
    }))
    .filter((stop) => stop.documents.length > 0);

  const hasNoFixedStopDoc = assessment.documents.some(
    (doc) =>
      officeRunPosition(doc.document_id, assessment) === null &&
      documentDisplayStatus(doc, assessment.findings) !== "uploaded",
  );

  if (stops.length === 0 && !hasNoFixedStopDoc) {
    return null;
  }

  return (
    <div className="mt-7">
      <p className="font-sans text-[11px] font-semibold tracking-[0.8px] text-tertiary-ink uppercase">
        Suggested office run
      </p>
      <p className="mt-1.5 max-w-2xl font-sans text-[13px] leading-5 text-secondary">
        The stops you still need, in the suggested order — a suggestion, not
        a rule.
      </p>
      <ol className="mt-3 max-w-2xl">
        {stops.map((stop) => (
          <li
            key={stop.position}
            className="flex items-baseline gap-3 border-t border-hairline py-2.5 first:border-t-0"
          >
            <span className="shrink-0 font-sans text-[11px] font-semibold tracking-[0.8px] text-tertiary-ink">
              {String(stop.position).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <p className="font-sans text-[13px] font-semibold text-ink">
                {stop.office}
              </p>
              <p className="font-sans text-xs leading-5 text-secondary">
                {stop.documents.map((doc, index) => {
                  const fullDoc = assessment.documents.find(
                    (candidate) => candidate.document_id === doc.documentId,
                  );
                  const unmet = fullDoc ? unmetPrerequisites(fullDoc, assessment) : [];
                  return (
                    <span key={doc.documentId}>
                      {index > 0 ? " · " : null}
                      {doc.title}{" "}
                      <span
                        className={`text-[10px] font-semibold tracking-[0.8px] uppercase ${STATUS_CLASS[doc.status]}`}
                      >
                        {documentStatusLabel(doc.status)}
                      </span>
                      {unmet.length > 0 ? (
                        <span className="text-ember">
                          {" "}
                          — needs{" "}
                          {unmet.map((prereq, i) => (
                            <span key={prereq.documentId}>
                              {i > 0 ? " and " : null}
                              <a
                                href={`#${documentRowAnchor(prereq.documentId)}`}
                                className="underline underline-offset-2"
                              >
                                {prereq.title}
                              </a>
                            </span>
                          ))}{" "}
                          first
                        </span>
                      ) : null}
                    </span>
                  );
                })}
              </p>
            </div>
          </li>
        ))}
        {hasNoFixedStopDoc ? (
          <li className="flex items-baseline gap-3 border-t border-hairline py-2.5 first:border-t-0">
            <span aria-hidden="true" className="shrink-0 font-sans text-[11px] font-semibold text-tertiary-ink">
              —
            </span>
            <p className="font-sans text-xs leading-5 text-secondary">
              Documents with no fixed office (notarized instruments, IDs you
              already hold) can be handled at any point along the way.
            </p>
          </li>
        ) : null}
      </ol>
    </div>
  );
}

export function DocumentChecklist({
  assessment,
  sessionUploads,
  onUpload,
}: {
  assessment: PermitAssessment;
  sessionUploads: ReadonlySet<string>;
  onUpload: (documentId: string, file: File) => void;
}) {
  const [showUploaded, setShowUploaded] = useState(false);
  const totalStops = officeRunStops(assessment).length;

  const renderRow = (document: PermitDocumentChecklistItem, quiet: boolean) => (
    <DocumentRow
      key={document.document_id}
      document={document}
      assessment={assessment}
      uploadedInSession={sessionUploads.has(document.document_id)}
      onUpload={(file) => onUpload(document.document_id, file)}
      quiet={quiet}
      totalStops={totalStops}
    />
  );

  const outstanding = assessment.documents.filter(
    (doc) => documentDisplayStatus(doc, assessment.findings) !== "uploaded",
  );
  const done = assessment.documents.filter(
    (doc) => documentDisplayStatus(doc, assessment.findings) === "uploaded",
  );

  return (
    <section aria-label="Document checklist">
      <Eyebrow>03 · Checklist</Eyebrow>
      <h2 className="mt-2 font-serif text-2xl font-medium text-ink">
        Documents you provide
      </h2>
      <p className="mt-2 max-w-2xl font-sans text-[13px] leading-5 text-secondary">
        Each row has its own upload slot — where you drop a file is how we
        know what it is. This list changes with your answers above.
      </p>

      {outstanding.length > 0 ? (
        <>
          <p className="mt-5 font-sans text-[11px] font-semibold tracking-[0.8px] text-ember uppercase">
            Still needs you
          </p>
          <ul className="mt-2 flex flex-col gap-2.5">
            {outstanding.map((document) => renderRow(document, false))}
          </ul>
        </>
      ) : null}
      {done.length > 0 ? (
        <>
          <button
            type="button"
            className="mt-5 flex items-center gap-1.5 font-sans text-[11px] font-semibold tracking-[0.8px] text-tertiary-ink uppercase hover:text-ink"
            onClick={() => setShowUploaded((current) => !current)}
            aria-expanded={showUploaded}
          >
            Uploaded · {done.length}
            <span
              aria-hidden="true"
              className={`transition-transform duration-150 ease-brand ${showUploaded ? "rotate-90" : ""}`}
            >
              ›
            </span>
          </button>
          {showUploaded ? (
            <ul className="mt-2 flex flex-col gap-2.5">
              {done.map((document) => renderRow(document, true))}
            </ul>
          ) : null}
        </>
      ) : null}

      <OfficeRunPlan assessment={assessment} />
    </section>
  );
}
