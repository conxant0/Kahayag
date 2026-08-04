// Defines the document checklist: one row per required document, each with
// its own upload slot (CLOSED-doc-slots.md — the slot itself tells us what a
// file is, no AI classification). Reuses the upload visual language from
// `frontend/src/features/compare/QuoteAuditorCard.tsx`.
import { useRef } from "react";

import type { PermitAssessment, PermitDocumentChecklistItem } from "./permitTypes";
import {
  DOCUMENT_CATALOG,
  documentDisplayStatus,
  documentStatusLabel,
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
  missing: "border-hairline bg-[#f2eee4] text-secondary",
  uploaded: "border-green-700/20 bg-[#f2faf4] text-green-800",
  needs_review: "border-ember/30 bg-[#fff5f2] text-ember",
  flagged: "border-ember/30 bg-[#fff5f2] text-ember",
};

function DocumentRow({
  document,
  assessment,
  uploadedInSession,
  onUpload,
}: {
  document: PermitDocumentChecklistItem;
  assessment: PermitAssessment;
  uploadedInSession: boolean;
  onUpload: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const catalogEntry = DOCUMENT_CATALOG[document.document_id];
  const displayStatus = documentDisplayStatus(document, assessment.findings);

  return (
    <li className="flex flex-col gap-3 border-b border-hairline py-4 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-sans text-sm font-semibold text-ink">{document.title}</p>
          {document.unverified ? (
            <span
              className="rounded-pill bg-[#fff4cc] px-2 py-0.5 font-sans text-[10px] font-semibold tracking-[0.4px] text-[#7a5c00] uppercase"
              title="This entry has not been independently confirmed against a primary source."
            >
              Unverified — confirm before relying on this
            </span>
          ) : null}
        </div>
        {catalogEntry ? (
          <p className="mt-1 font-sans text-[12px] text-secondary">
            {catalogEntry.issuing_agency} ·{" "}
            <a
              href={catalogEntry.source_url}
              target="_blank"
              rel="noreferrer"
              className="text-cobalt underline underline-offset-2"
            >
              Source
            </a>
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span
          className={`rounded-pill border px-2.5 py-1 font-sans text-[11px] font-semibold whitespace-nowrap ${STATUS_CLASS[displayStatus]}`}
        >
          {documentStatusLabel(displayStatus)}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/*"
          className="sr-only"
          onChange={(event) => {
            if (event.target.files?.[0]) {
              onUpload();
            }
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-hairline bg-white px-3 font-sans text-[12px] font-semibold text-ink hover:border-tertiary"
        >
          <UploadIcon />
          {uploadedInSession || document.status === "uploaded"
            ? "Replace"
            : "Upload"}
        </button>
      </div>
    </li>
  );
}

export function DocumentChecklist({
  assessment,
  sessionUploads,
  onUpload,
}: {
  assessment: PermitAssessment;
  sessionUploads: ReadonlySet<string>;
  onUpload: (documentId: string) => void;
}) {
  return (
    <section
      aria-label="Document checklist"
      className="rounded-[20px] border border-hairline bg-white p-5 lg:p-6"
    >
      <p className="font-sans text-[11px] font-semibold tracking-[1.4px] text-tertiary-ink uppercase">
        Checklist
      </p>
      <h2 className="mt-1 font-serif text-2xl font-medium text-ink">
        Documents you provide
      </h2>
      <p className="mt-2 font-sans text-[13px] leading-5 text-secondary">
        Each row has its own upload slot — where you drop a file is how we
        know what it is.
      </p>

      <ul className="mt-4">
        {assessment.documents.map((document) => (
          <DocumentRow
            key={document.document_id}
            document={document}
            assessment={assessment}
            uploadedInSession={sessionUploads.has(document.document_id)}
            onUpload={() => onUpload(document.document_id)}
          />
        ))}
      </ul>
    </section>
  );
}
