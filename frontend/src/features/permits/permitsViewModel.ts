// Derives display-only values from a PermitAssessment. No number here is
// computed — track, findings, and statuses all come from the assessment
// payload (in T3b, from the domain). This module only decides how to show them.
//
// T3a-v2 adds `deriveAssessment`: the fixture's per-scenario base assessment
// (document statuses, findings) still supplies the "what did intake find"
// data, but which documents are required — including the notarized
// authorization row — is now re-derived from the live form on every render,
// matching app.domain.permits.rules.required_documents. This is still
// fixture-driven (T3b wires the real domain), just no longer form-blind.
import type { ApplicantFormValues } from "./ApplicantForm";
import type {
  ApplicantAnswers,
  DocumentSlotStatus,
  FindingSeverity,
  PacketStatus,
  PermitAssessment,
  PermitDocumentChecklistItem,
  PermitFinding,
  PermitTrack,
} from "./permitTypes";

/**
 * Issuing office, source link, legal basis, and a source excerpt per
 * document, keyed by document_id. Matches the entries in
 * `backend/app/data/cebu_permits_catalog.json` for the homeowner-facing
 * subset this preview covers (CLOSED-document-scope.md).
 *
 * The wire contract (schemas.py) does not carry these per document — only
 * `NetMeteringEligibilitySchema` has a `source_url`. This is presentation
 * metadata the checklist needs regardless of who answers the request, so it
 * is a static lookup here rather than invented per document. Whether it
 * belongs on the backend response instead is a call for the owner before T3b.
 */
export const DOCUMENT_CATALOG: Record<
  string,
  {
    title: string;
    issuing_agency: string;
    source_url: string;
    legal_basis: string;
    source_excerpt: string;
    /** Sourced validity/expiry note, where the research confirms one. */
    validity_note?: string;
    /**
     * Ordered plain-language actions for obtaining the document, transcribed
     * from the submission research chrisb588 pasted into PR #32 (the
     * `.wayfinder/cebu-permit-submission-research.md` content) — per the PR
     * constraint, permit facts come from the research, never from memory.
     * Office names only, never a floor or room number: sources conflict on
     * those, per the research's own fact-check pass.
     */
    steps?: readonly string[];
  }
> = {
  tct: {
    title: "Transfer Certificate of Title (TCT)",
    issuing_agency: "Registry of Deeds, Cebu City",
    source_url:
      "https://www.cebucity.gov.ph/wp-content/uploads/2023/09/OBO-FM-PII-B-36-v.00-Requirements-Checklist-Building-Permit.pdf",
    legal_basis:
      "Cebu City OBO Building Permit Requirements Checklist, item 14 (Certified True Copy of Lot Title).",
    source_excerpt:
      '"Certified True Copy of Lot Title (TCT)" — OBO-FM-PII-B-36 v.00, item 14.',
    validity_note:
      "No explicit validity window, but it must be a certified true copy — which implies a recent one.",
    steps: [
      "Request a certified true copy online through the LRA eSerbisyo portal (eserbisyo.lra.gov.ph) — delivered to you, no office visit needed.",
      "Have the registered owner's name, title (TCT) number, and lot number on hand.",
      "Allow 5–7 working days for a provincial request like Cebu — and up to two weeks if the title needs manual validation.",
      "Prefer going in person? The Registry of Deeds also serves walk-in requests.",
    ],
  },
  tax_declaration: {
    title: "Tax Declaration",
    issuing_agency: "City Assessor's Office, Cebu City",
    source_url:
      "https://www.cebucity.gov.ph/wp-content/uploads/2023/09/OBO-FM-PII-B-36-v.00-Requirements-Checklist-Building-Permit.pdf",
    legal_basis: "Cebu City OBO Building Permit Requirements Checklist, item 15.",
    source_excerpt:
      '"Certified True Copy of Lot Tax Declaration" — OBO-FM-PII-B-36 v.00, item 15.',
    steps: [
      "Go to the City Assessor's Office at Cebu City Hall and request a certified true copy of the lot's tax declaration.",
      "Have the owner's name, tax declaration number, and lot number on hand — the copy must carry them exactly as registered.",
    ],
  },
  tax_clearance: {
    title: "Real Property Tax Clearance",
    issuing_agency: "City Treasurer's Office, Cebu City",
    source_url:
      "https://www.cebucity.gov.ph/wp-content/uploads/2023/09/OBO-FM-PII-B-36-v.00-Requirements-Checklist-Building-Permit.pdf",
    legal_basis: "Cebu City OBO Building Permit Requirements Checklist, item 16.",
    source_excerpt:
      '"Certified True Copy of Lot Tax Clearance" — OBO-FM-PII-B-36 v.00, item 16. Reflects current-year real property tax payment status.',
    validity_note:
      "Annual — reflects current-year real property tax payment status.",
    steps: [
      "Go to the City Treasurer's Office at Cebu City Hall and request a real property tax clearance for the lot.",
      "Real property tax must be paid up for the current year — the clearance reflects that payment status.",
      "Your cedula comes from the same office, so one visit can cover both.",
    ],
  },
  barangay_clearance: {
    title: "Barangay Clearance",
    issuing_agency: "Barangay Hall (property's barangay)",
    source_url:
      "https://www.cebucity.gov.ph/wp-content/uploads/2023/09/OBO-FM-PII-B-36-v.00-Requirements-Checklist-Building-Permit.pdf",
    legal_basis: "Cebu City OBO Building Permit Requirements Checklist, item 12.",
    source_excerpt: '"Barangay Clearance" — OBO-FM-PII-B-36 v.00, item 12.',
    steps: [
      "Go to the barangay hall of the barangay that covers the property and request a barangay clearance for construction.",
      "Address and office hours vary per barangay — check with yours before heading out.",
    ],
  },
  cedula: {
    title: "Community Tax Certificate (Cedula)",
    issuing_agency: "City Treasurer's Office, Cebu City",
    source_url: "https://cebucity.gov.ph/city-treasurers-office/",
    legal_basis:
      "Local Government Code (RA 7160) community tax certificate requirement, commonly requested alongside a barangay clearance.",
    source_excerpt:
      "Community Tax Certificate (Cedula) — annual, issued by the City Treasurer's Office.",
    validity_note: "Issued yearly — must be dated for the current year.",
    steps: [
      "Request a Community Tax Certificate (cedula) at the City Treasurer's Office, Cebu City Hall — the same office that issues the tax clearance, so one visit covers both.",
      "Check the date before leaving the counter: it must be issued for the current year.",
    ],
  },
  valid_id: {
    title: "Valid Government-Issued ID",
    issuing_agency: "Any government-issued photo ID",
    source_url: "https://www.visayanelectric.com/customer-services/apply-electrical-connection-1",
    legal_basis:
      'Visayan Electric net-metering application requirements — "Valid IDs & Proof of Ownership".',
    source_excerpt: "VECO customer service page, Apply for Electrical Connection.",
  },
  notarized_authorization: {
    title: "Notarized Consent and Authority to file",
    issuing_agency: "Any commissioned notary public",
    source_url:
      "https://www.cebucity.gov.ph/wp-content/uploads/2023/09/OBO-FM-PII-B-36-v.00-Requirements-Checklist-Building-Permit.pdf",
    legal_basis:
      "Cebu City OBO Building Permit Requirements Checklist, item 18 (Consent and Authority, notarized) — required only if the applicant is not the registered owner.",
    source_excerpt: '"Consent and Authority (notarized)" — OBO-FM-PII-B-36 v.00, item 18.',
    steps: [
      "Have the registered owner write and sign a Consent and Authority naming who is authorized to file for this property.",
      "Bring it to any commissioned notary public for notarization — this can happen at any point, in any order.",
    ],
  },
};

/**
 * The sourced office visiting order for the homeowner's document run —
 * Barangay → City Assessor → City Treasurer → Registry of Deeds — from the
 * Cebu submission research (quoted in PR #32 review; the CPDO, OBO, and VECO
 * stops that follow are installer-side and out of this screen's scope).
 * Offices are keyed by the documents they issue; the label comes from the
 * catalog so the two never disagree. The notarized authorization has no fixed
 * stop — any commissioned notary, at any point.
 */
const OFFICE_RUN_DOCUMENT_IDS: readonly (readonly string[])[] = [
  ["barangay_clearance"],
  ["tax_declaration"],
  ["tax_clearance", "cedula"],
  ["tct"],
];

export type OfficeRunStop = {
  position: number;
  office: string;
  documents: readonly {
    documentId: string;
    title: string;
    status: DocumentDisplayStatus;
  }[];
};

/**
 * The trip plan for this assessment: the sourced office order, restricted to
 * offices issuing documents actually on the checklist, each carrying its
 * documents' current display status so resolved stops can quiet down.
 */
export function officeRunStops(assessment: PermitAssessment): OfficeRunStop[] {
  const docById = new Map(
    assessment.documents.map((doc) => [doc.document_id, doc]),
  );
  const stops: OfficeRunStop[] = [];
  for (const documentIds of OFFICE_RUN_DOCUMENT_IDS) {
    const documents = documentIds.flatMap((id) => {
      const doc = docById.get(id);
      return doc
        ? [
            {
              documentId: id,
              title: doc.title,
              status: documentDisplayStatus(doc, assessment.findings),
            },
          ]
        : [];
    });
    if (documents.length > 0) {
      stops.push({
        position: stops.length + 1,
        office: DOCUMENT_CATALOG[documents[0].documentId]?.issuing_agency ?? "",
        documents,
      });
    }
  }
  return stops;
}

/** Which stop of the office run issues this document — null for documents
 * with no fixed stop (the notarized authorization). */
export function officeRunPosition(documentId: string): number | null {
  const index = OFFICE_RUN_DOCUMENT_IDS.findIndex((ids) =>
    ids.includes(documentId),
  );
  return index === -1 ? null : index + 1;
}

/** Homeowner-facing document sets per track (app.domain.permits.catalog.documents_for_track,
 * filtered to the homeowner-produced subset per CLOSED-document-scope.md). */
const STREAMLINED_DOCUMENT_IDS = ["tct", "tax_declaration", "barangay_clearance"] as const;
const RETROFIT_DOCUMENT_IDS = [
  "tct",
  "tax_declaration",
  "tax_clearance",
  "barangay_clearance",
  "cedula",
] as const;
const OWNER_MISMATCH_DOCUMENT_ID = "notarized_authorization";

/** Mirrors app.domain.permits.rules.resolve_track: "yes" is the only opt-in to
 * the streamlined track; "no" or "not_sure" defaults to the fuller retrofit
 * track, the safer direction to be wrong in. */
export function resolveTrack(
  solarInOriginalPermit: ApplicantFormValues["solarInOriginalPermit"],
): PermitTrack {
  return solarInOriginalPermit === "yes" ? "streamlined" : "retrofit";
}

export function toApiApplicant(values: ApplicantFormValues): ApplicantAnswers {
  return {
    solar_in_original_permit: values.solarInOriginalPermit,
    full_name: values.fullName,
    is_registered_owner: values.isRegisteredOwner === "yes",
    registered_owner_name:
      values.isRegisteredOwner === "no" ? values.registeredOwnerName || null : null,
  };
}

export function fromApiApplicant(answers: ApplicantAnswers): ApplicantFormValues {
  return {
    solarInOriginalPermit: answers.solar_in_original_permit,
    fullName: answers.full_name,
    isRegisteredOwner: answers.is_registered_owner ? "yes" : "no",
    registeredOwnerName: answers.registered_owner_name ?? "",
  };
}

function requiredDocumentIds(applicant: ApplicantFormValues): string[] {
  const track = resolveTrack(applicant.solarInOriginalPermit);
  const base =
    track === "streamlined" ? STREAMLINED_DOCUMENT_IDS : RETROFIT_DOCUMENT_IDS;
  return applicant.isRegisteredOwner === "no"
    ? [...base, OWNER_MISMATCH_DOCUMENT_ID]
    : [...base];
}

/**
 * Re-derives the checklist, findings, packet status, and summary from the
 * live form and this-session uploads, starting from a fixture "base"
 * assessment that supplies per-document intake results (status, expiry,
 * unreadable/mismatch findings) for whichever documents it happens to cover.
 *
 * A document required by the form but absent from the base fixture (for
 * example the notarized authorization row, or a document a track switch just
 * pulled in) defaults to "missing" — the same as a homeowner who has not
 * touched that slot yet.
 */
export function deriveAssessment(
  base: PermitAssessment,
  applicant: ApplicantFormValues,
  sessionUploads: ReadonlySet<string>,
): PermitAssessment {
  const track = resolveTrack(applicant.solarInOriginalPermit);
  const requiredIds = requiredDocumentIds(applicant);
  const baseDocById = new Map(base.documents.map((doc) => [doc.document_id, doc]));

  const documents: PermitDocumentChecklistItem[] = requiredIds.map((id) => {
    const baseDoc = baseDocById.get(id);
    const catalogEntry = DOCUMENT_CATALOG[id];
    const status: DocumentSlotStatus = sessionUploads.has(id)
      ? "uploaded"
      : (baseDoc?.status ?? "missing");
    return {
      document_id: id,
      title: baseDoc?.title ?? catalogEntry?.title ?? id,
      status,
      expires: baseDoc?.expires ?? null,
      unverified: baseDoc?.unverified ?? false,
    };
  });

  const requiredIdSet = new Set(requiredIds);
  let findings: PermitFinding[] = base.findings.filter(
    (finding) =>
      (finding.document_id === null || requiredIdSet.has(finding.document_id)) &&
      !(finding.document_id !== null && sessionUploads.has(finding.document_id)),
  );

  // The notarized-authorization row is the one requirement this preview
  // synthesises a finding for when the base fixture doesn't already carry
  // one — every other row's findings come straight from the fixture's intake
  // simulation. See CLOSED-ai-surface.md: this is a plain conditional, not a
  // model asserting anything.
  if (applicant.isRegisteredOwner === "no" && requiredIdSet.has(OWNER_MISMATCH_DOCUMENT_ID)) {
    const notarizedDoc = documents.find(
      (doc) => doc.document_id === OWNER_MISMATCH_DOCUMENT_ID,
    );
    const alreadyFlagged = findings.some(
      (finding) => finding.document_id === OWNER_MISMATCH_DOCUMENT_ID,
    );
    if (notarizedDoc && notarizedDoc.status !== "uploaded" && !alreadyFlagged) {
      const ownerName = applicant.registeredOwnerName.trim() || "the registered owner";
      findings = [
        ...findings,
        {
          document_id: OWNER_MISMATCH_DOCUMENT_ID,
          category: "presence",
          severity: "blocking",
          message: `You told us you are not the registered owner, so a notarized authorization from ${ownerName} is required and has not been uploaded yet.`,
        },
      ];
    }
  }

  const allUploaded = documents.every((doc) => doc.status === "uploaded");
  const hasBlockingFinding = findings.some((finding) => finding.severity === "blocking");
  const packet_status: PacketStatus = allUploaded && !hasBlockingFinding ? "ready" : "incomplete";

  return {
    track,
    net_metering_eligibility: base.net_metering_eligibility,
    permits: base.permits,
    documents,
    findings,
    packet_status,
    summary: deriveSummary(documents, findings, packet_status),
  };
}

function deriveSummary(
  documents: readonly PermitDocumentChecklistItem[],
  findings: readonly PermitFinding[],
  packetStatus: PacketStatus,
): string {
  if (packetStatus === "ready") {
    return "All required documents are uploaded, readable, and consistent with the name you entered. Your side of the paperwork is ready to hand off to your installer.";
  }
  const missingCount = documents.filter((doc) => doc.status === "missing").length;
  const blockingCount = findings.filter((finding) => finding.severity === "blocking").length;
  const parts: string[] = [];
  if (missingCount > 0) {
    parts.push(`${missingCount} document${missingCount === 1 ? " is" : "s are"} still missing`);
  }
  if (blockingCount > 0) {
    parts.push(`${blockingCount} issue${blockingCount === 1 ? "" : "s"} need${blockingCount === 1 ? "s" : ""} your attention`);
  }
  if (parts.length === 0) {
    return "Some documents still need manual review below before this packet is ready to hand off.";
  }
  return `${parts.join(" and ")} below. Resolve these before handing the packet to your installer.`;
}

/** Count of required documents with no open finding against them — the
 * "how much of your side is done" figure the progress bar shows (item 4). */
export function progressSummary(assessment: PermitAssessment): {
  resolved: number;
  total: number;
  ratio: number;
} {
  const total = assessment.documents.length;
  const resolved = assessment.documents.filter((doc) => {
    if (doc.status !== "uploaded") {
      return false;
    }
    return !assessment.findings.some(
      (finding) =>
        finding.document_id === doc.document_id &&
        (finding.severity === "warning" || finding.severity === "blocking"),
    );
  }).length;
  return { resolved, total, ratio: total === 0 ? 0 : resolved / total };
}

/**
 * The chat's deterministic opening messages: the summary always leads, and
 * when `includeFindings` (the findings-in-chat preview variant) each finding
 * follows as its own message, in assessment order, prefixed with its severity
 * and document. Every string comes from the assessment — nothing is phrased
 * here (CLOSED-verdict-source.md).
 */
export function chatOpeningMessages(
  assessment: PermitAssessment,
  includeFindings: boolean,
): string[] {
  if (!includeFindings) {
    return [assessment.summary];
  }
  const titleById = new Map(
    assessment.documents.map((doc) => [doc.document_id, doc.title]),
  );
  return [
    assessment.summary,
    ...assessment.findings.map((finding) => {
      const title = finding.document_id
        ? titleById.get(finding.document_id)
        : undefined;
      return `${findingSeverityLabel(finding.severity)}${title ? ` · ${title}` : ""} — ${finding.message}`;
    }),
  ];
}

/** Titles of required documents that still need the homeowner — missing,
 * needs review, or uploaded with an open finding. What the verdict names so
 * "not yet complete" is immediately actionable. */
export function outstandingDocumentTitles(assessment: PermitAssessment): string[] {
  return assessment.documents
    .filter((doc) => documentDisplayStatus(doc, assessment.findings) !== "uploaded")
    .map((doc) => doc.title);
}

export type DocumentDisplayStatus = DocumentSlotStatus | "flagged";

/**
 * "Flagged" is not a wire status — it is an uploaded document with an
 * open warning or blocking finding against it, surfaced so the row does not
 * read as settled just because a file landed in the slot.
 */
export function documentDisplayStatus(
  document: PermitDocumentChecklistItem,
  findings: readonly PermitFinding[],
): DocumentDisplayStatus {
  if (document.status !== "uploaded") {
    return document.status;
  }
  const hasOpenFinding = findings.some(
    (finding) =>
      finding.document_id === document.document_id &&
      (finding.severity === "warning" || finding.severity === "blocking"),
  );
  return hasOpenFinding ? "flagged" : "uploaded";
}

export function findingsForDocument(
  findings: readonly PermitFinding[],
  documentId: string,
): readonly PermitFinding[] {
  return findings.filter((finding) => finding.document_id === documentId);
}

/** What the expanded document row shows under "What we found" — built from
 * the same findings the findings panel shows, not a separate invented text. */
export function documentExtractionSummary(
  document: PermitDocumentChecklistItem,
  findings: readonly PermitFinding[],
): string {
  if (document.status === "missing") {
    return "Nothing extracted yet — this slot is still empty.";
  }
  const openFindings = findingsForDocument(findings, document.document_id).filter(
    (finding) => finding.severity !== "info",
  );
  if (openFindings.length > 0) {
    return openFindings.map((finding) => finding.message).join(" ");
  }
  if (document.status === "needs_review") {
    return "Uploaded, but this document is flagged for manual review.";
  }
  return "Extracted cleanly — name and address matched what you entered, nothing flagged.";
}

const STATUS_LABEL: Record<DocumentDisplayStatus, string> = {
  missing: "Missing",
  uploaded: "Uploaded",
  needs_review: "Needs manual review",
  flagged: "Flagged",
};

export function documentStatusLabel(status: DocumentDisplayStatus): string {
  return STATUS_LABEL[status];
}

const SEVERITY_LABEL: Record<FindingSeverity, string> = {
  info: "Info",
  warning: "Warning",
  blocking: "Blocking",
};

export function findingSeverityLabel(severity: FindingSeverity): string {
  return SEVERITY_LABEL[severity];
}

/**
 * The non-negotiable verdict copy. Must always read as "your side is
 * complete" and must never read as "the permit application is complete" or
 * "ready to file" — see CLOSED-document-scope.md. Installer and
 * licensed-professional documents (sealed building plans, PEE-signed
 * drawings) are out of scope for this app entirely.
 */
export function verdictBannerCopy(assessment: PermitAssessment): {
  ready: boolean;
  heading: string;
  body: string;
} {
  const blockingCount = assessment.findings.filter(
    (finding) => finding.severity === "blocking",
  ).length;
  const ready = assessment.packet_status === "ready" && blockingCount === 0;

  if (ready) {
    return {
      ready: true,
      heading: "Your side of the paperwork is complete",
      body: "Every homeowner-supplied document is uploaded, readable, and consistent. This does not mean your permit application is complete — your installer's architect and engineers still owe their own sealed plans and filings before anything can be submitted to the OBO.",
    };
  }

  return {
    ready: false,
    heading: "Your side of the paperwork is not yet complete",
    body:
      blockingCount > 0
        ? `${blockingCount} document${blockingCount === 1 ? "" : "s"} still ${blockingCount === 1 ? "needs" : "need"} your attention below. Once resolved, this only covers your side — your installer's architect and engineers still owe their own sealed plans and filings.`
        : "Some documents are still missing or need review below. Once resolved, this only covers your side — your installer's architect and engineers still owe their own sealed plans and filings.",
  };
}

/**
 * Packet-status copy. Must never imply anything has been filed — eGov
 * submission is not connected yet (see CLOSED-egov-output.md).
 */
export function packetStatusCopy(assessment: PermitAssessment): {
  heading: string;
  body: string;
} {
  if (assessment.packet_status === "ready") {
    return {
      heading: "Packet ready to hand off",
      body: "Your documents are organised and ready to give to your installer. Nothing has been submitted — direct eGov filing is not connected yet.",
    };
  }
  return {
    heading: "Packet not ready yet",
    body: "Resolve the missing or flagged documents below before this packet is ready to hand off. Nothing is submitted automatically — direct eGov filing is not connected yet.",
  };
}
