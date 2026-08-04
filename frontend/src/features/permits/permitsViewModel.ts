// Derives display-only values from a PermitAssessment. No number here is
// computed — track, findings, and statuses all come from the assessment
// payload (in T3b, from the domain). This module only decides how to show them.
import type {
  DocumentSlotStatus,
  FindingSeverity,
  PermitAssessment,
  PermitDocumentChecklistItem,
  PermitFinding,
} from "./permitTypes";

/**
 * Issuing office and source link per document, keyed by document_id.
 *
 * The wire contract (schemas.py) does not carry these per document — only
 * `NetMeteringEligibilitySchema` has a `source_url`. This is presentation
 * metadata the checklist needs regardless of who answers the request, so it
 * is a static lookup here rather than invented per document. Whether it
 * belongs on the backend response instead is a call for the owner before T3b.
 */
export const DOCUMENT_CATALOG: Record<
  string,
  { issuing_agency: string; source_url: string }
> = {
  tct: {
    issuing_agency: "Registry of Deeds, Cebu City",
    source_url: "https://lra.gov.ph/",
  },
  tax_declaration: {
    issuing_agency: "City Assessor's Office, Cebu City",
    source_url: "https://cebucity.gov.ph/city-assessors-office/",
  },
  tax_clearance: {
    issuing_agency: "City Treasurer's Office, Cebu City",
    source_url: "https://cebucity.gov.ph/city-treasurers-office/",
  },
  barangay_clearance: {
    issuing_agency: "Barangay Hall (property's barangay)",
    source_url: "https://cebucity.gov.ph/",
  },
  cedula: {
    issuing_agency: "City Treasurer's Office, Cebu City",
    source_url: "https://cebucity.gov.ph/city-treasurers-office/",
  },
  valid_id: {
    issuing_agency: "Any government-issued photo ID",
    source_url: "https://cebucity.gov.ph/",
  },
  notarized_authorization: {
    issuing_agency: "Any commissioned notary public",
    source_url: "https://cebucity.gov.ph/",
  },
};

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
