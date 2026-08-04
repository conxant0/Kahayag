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
 * Source link, legal basis, and a source excerpt per document, keyed by
 * document_id. Matches the entries in `backend/app/data/cebu_permits_catalog.json`
 * for the homeowner-facing subset this preview covers (CLOSED-document-scope.md).
 *
 * Steps, prerequisites, and the issuing office are NOT here — those come
 * straight off the assessment response's `PermitDocumentChecklistItem`
 * (issue #37: permit content is domain data, served with the assessment,
 * never duplicated as frontend copy — AGENTS.md rule 1). This map only
 * carries what the wire contract still doesn't (legal citation, a source
 * excerpt) — whether those belong on the backend response too is a call for
 * the owner, not scope creep for this ticket.
 */
export const DOCUMENT_CATALOG: Record<
  string,
  {
    title: string;
    source_url: string;
    legal_basis: string;
    source_excerpt: string;
    /** Sourced validity/expiry note, where the research confirms one. */
    validity_note?: string;
  }
> = {
  obo_14_tct: {
    title: "Transfer Certificate of Title (TCT)",
    source_url:
      "https://www.cebucity.gov.ph/wp-content/uploads/2023/09/OBO-FM-PII-B-36-v.00-Requirements-Checklist-Building-Permit.pdf",
    legal_basis:
      "Cebu City OBO Building Permit Requirements Checklist, item 14 (Certified True Copy of Lot Title).",
    source_excerpt:
      '"Certified True Copy of Lot Title (TCT)" — OBO-FM-PII-B-36 v.00, item 14.',
    validity_note:
      "No explicit validity window, but it must be a certified true copy — which implies a recent one.",
  },
  obo_15_tax_declaration_lot: {
    title: "Tax Declaration",
    source_url:
      "https://www.cebucity.gov.ph/wp-content/uploads/2023/09/OBO-FM-PII-B-36-v.00-Requirements-Checklist-Building-Permit.pdf",
    legal_basis: "Cebu City OBO Building Permit Requirements Checklist, item 15.",
    source_excerpt:
      '"Certified True Copy of Lot Tax Declaration" — OBO-FM-PII-B-36 v.00, item 15.',
  },
  obo_16_tax_clearance_lot: {
    title: "Real Property Tax Clearance",
    source_url:
      "https://www.cebucity.gov.ph/wp-content/uploads/2023/09/OBO-FM-PII-B-36-v.00-Requirements-Checklist-Building-Permit.pdf",
    legal_basis: "Cebu City OBO Building Permit Requirements Checklist, item 16.",
    source_excerpt:
      '"Certified True Copy of Lot Tax Clearance" — OBO-FM-PII-B-36 v.00, item 16. Reflects current-year real property tax payment status.',
    validity_note:
      "Annual — reflects current-year real property tax payment status.",
  },
  obo_12_barangay_clearance: {
    title: "Barangay Clearance",
    source_url:
      "https://www.cebucity.gov.ph/wp-content/uploads/2023/09/OBO-FM-PII-B-36-v.00-Requirements-Checklist-Building-Permit.pdf",
    legal_basis: "Cebu City OBO Building Permit Requirements Checklist, item 12.",
    source_excerpt: '"Barangay Clearance" — OBO-FM-PII-B-36 v.00, item 12.',
  },
  veco_valid_government_id: {
    title: "Valid Government-Issued ID",
    source_url: "https://www.visayanelectric.com/customer-services/apply-electrical-connection-1",
    legal_basis:
      'Visayan Electric net-metering application requirements — "Valid IDs & Proof of Ownership".',
    source_excerpt: "VECO customer service page, Apply for Electrical Connection.",
  },
  obo_18_consent_and_authority: {
    title: "Consent and Authority (notarized)",
    source_url:
      "https://www.cebucity.gov.ph/wp-content/uploads/2023/09/OBO-FM-PII-B-36-v.00-Requirements-Checklist-Building-Permit.pdf",
    legal_basis:
      "Cebu City OBO Building Permit Requirements Checklist, item 18 — required only if the applicant is not the registered owner.",
    source_excerpt: '"Consent and Authority (notarized)" — OBO-FM-PII-B-36 v.00, item 18.',
  },
};

/**
 * A document with no fixed office to visit — self-supplied (an ID, an
 * existing ownership paper) or notarized anywhere by any commissioned
 * notary. These sit outside the office run: no stop to assign them to, no
 * order to get them wrong.
 */
function hasFixedOffice(issuingAgency: string): boolean {
  const agency = issuingAgency.toLowerCase();
  return !agency.startsWith("n/a") && !agency.includes("notary");
}

/**
 * Orders required documents so every prerequisite appears before what
 * depends on it (Kahn's algorithm), breaking ties by the assessment's own
 * order so the result is stable. A prerequisite that isn't part of this
 * assessment (wrong track, already excluded) is ignored rather than
 * blocking the sort.
 */
function topologicalOrder(
  documents: readonly PermitDocumentChecklistItem[],
): PermitDocumentChecklistItem[] {
  const ids = new Set(documents.map((doc) => doc.document_id));
  const indexOf = new Map(documents.map((doc, index) => [doc.document_id, index]));
  const dependents = new Map<string, string[]>(documents.map((doc) => [doc.document_id, []]));
  const indegree = new Map<string, number>(documents.map((doc) => [doc.document_id, 0]));

  for (const doc of documents) {
    for (const prereqId of doc.prerequisites) {
      if (!ids.has(prereqId)) continue;
      dependents.get(prereqId)!.push(doc.document_id);
      indegree.set(doc.document_id, (indegree.get(doc.document_id) ?? 0) + 1);
    }
  }

  const ready = documents.filter((doc) => indegree.get(doc.document_id) === 0);
  const queue = [...ready].sort((a, b) => indexOf.get(a.document_id)! - indexOf.get(b.document_id)!);
  const byId = new Map(documents.map((doc) => [doc.document_id, doc]));
  const ordered: PermitDocumentChecklistItem[] = [];

  while (queue.length > 0) {
    const doc = queue.shift()!;
    ordered.push(doc);
    const nextReady: PermitDocumentChecklistItem[] = [];
    for (const dependentId of dependents.get(doc.document_id) ?? []) {
      const remaining = (indegree.get(dependentId) ?? 0) - 1;
      indegree.set(dependentId, remaining);
      if (remaining === 0) nextReady.push(byId.get(dependentId)!);
    }
    queue.push(...nextReady);
    queue.sort((a, b) => indexOf.get(a.document_id)! - indexOf.get(b.document_id)!);
  }

  // A prerequisite cycle shouldn't happen with sourced catalog data, but
  // fall back to the original order rather than silently dropping a
  // document if it ever does.
  if (ordered.length < documents.length) {
    const seen = new Set(ordered.map((doc) => doc.document_id));
    for (const doc of documents) if (!seen.has(doc.document_id)) ordered.push(doc);
  }

  return ordered;
}

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
 * The trip plan for this assessment: required documents with a fixed office,
 * ordered so a prerequisite's stop always comes before its dependent's
 * (issue #37 — the run must not send the homeowner to a stop whose
 * prerequisite is still outstanding without saying so; see `whenToGetIt`),
 * then grouped into stops by consecutive same-office documents.
 */
export function officeRunStops(assessment: PermitAssessment): OfficeRunStop[] {
  const fixedOfficeDocs = assessment.documents.filter((doc) => hasFixedOffice(doc.issuing_agency));
  const ordered = topologicalOrder(fixedOfficeDocs);

  const stops: OfficeRunStop[] = [];
  for (const doc of ordered) {
    const entry = {
      documentId: doc.document_id,
      title: doc.title,
      status: documentDisplayStatus(doc, assessment.findings),
    };
    const last = stops[stops.length - 1];
    if (last && last.office === doc.issuing_agency) {
      stops[stops.length - 1] = { ...last, documents: [...last.documents, entry] };
    } else {
      stops.push({ position: stops.length + 1, office: doc.issuing_agency, documents: [entry] });
    }
  }
  return stops;
}

/** Which stop of the office run issues this document — null for documents
 * with no fixed stop (self-supplied, or notarized anywhere). */
export function officeRunPosition(documentId: string, assessment: PermitAssessment): number | null {
  const stops = officeRunStops(assessment);
  const stop = stops.find((candidate) =>
    candidate.documents.some((doc) => doc.documentId === documentId),
  );
  return stop?.position ?? null;
}

/** Id and title of this document's prerequisites that are still outstanding —
 * empty when every prerequisite is uploaded, or there are none. The id lets
 * the UI link straight to that document's row. */
export function unmetPrerequisites(
  document: PermitDocumentChecklistItem,
  assessment: PermitAssessment,
): { documentId: string; title: string }[] {
  const byId = new Map(assessment.documents.map((doc) => [doc.document_id, doc]));
  return document.prerequisites.flatMap((prereqId) => {
    const prereq = byId.get(prereqId);
    if (!prereq) return [];
    return documentDisplayStatus(prereq, assessment.findings) !== "uploaded"
      ? [{ documentId: prereq.document_id, title: prereq.title }]
      : [];
  });
}

/** Anchor id for a document's row, for linking to it from elsewhere on the
 * page (e.g. an unmet-prerequisite pointer). */
export function documentRowAnchor(documentId: string): string {
  return `document-${documentId}`;
}

/** Homeowner-facing document sets per track (app.domain.permits.catalog.documents_for_track,
 * filtered to the homeowner-produced subset per CLOSED-document-scope.md). */
const STREAMLINED_DOCUMENT_IDS = [
  "obo_14_tct",
  "obo_15_tax_declaration_lot",
  "obo_12_barangay_clearance",
] as const;
const RETROFIT_DOCUMENT_IDS = [
  "obo_14_tct",
  "obo_15_tax_declaration_lot",
  "obo_16_tax_clearance_lot",
  "obo_12_barangay_clearance",
] as const;
const OWNER_MISMATCH_DOCUMENT_ID = "obo_18_consent_and_authority";

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
    delegates_filing_to_representative: values.delegatesFilingToRepresentative,
  };
}

export function fromApiApplicant(answers: ApplicantAnswers): ApplicantFormValues {
  return {
    solarInOriginalPermit: answers.solar_in_original_permit,
    fullName: answers.full_name,
    isRegisteredOwner: answers.is_registered_owner ? "yes" : "no",
    registeredOwnerName: answers.registered_owner_name ?? "",
    delegatesFilingToRepresentative: answers.delegates_filing_to_representative,
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
      issuing_agency: baseDoc?.issuing_agency ?? "",
      steps: baseDoc?.steps ?? [],
      prerequisites: baseDoc?.prerequisites ?? [],
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
 * open warning or blocking finding against it, or one intake has not
 * independently verified, surfaced so the row does not read as settled
 * just because a file landed in the slot.
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
  return hasOpenFinding || document.unverified ? "flagged" : "uploaded";
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
