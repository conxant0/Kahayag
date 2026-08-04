# Defines per-slot document intake: six deterministic check classes over
# uploaded permit documents, plus AI phrasing bound to the computed findings.
#
# The model (via DocumentIntakeClient) only reads a document into fields.
# Every accept/reject verdict below is a deterministic Python comparison —
# never an AI decision. See AGENTS.md rule 1 and CLOSED-doc-reading.md.

import re
from dataclasses import dataclass
from datetime import UTC, date, datetime

from app.domain.permits.catalog import DocumentRequirement, load_catalog
from app.domain.permits.entities import ApplicantAnswers, PermitBuildSpec
from app.domain.permits.rules import (
    check_net_metering_eligibility,
    required_documents,
    required_permits,
    resolve_track,
)
from app.features.design.quote_audit import extract_document_text
from app.features.permits.schemas import (
    NetMeteringEligibilitySchema,
    PermitAssessmentResponseSchema,
    PermitDocumentChecklistItemSchema,
    PermitFindingSchema,
    PermitRequirementSchema,
)
from app.integrations.ai.document_intake import DocumentIntakeClient

# Expected-keyword check per document slot (CLOSED-doc-slots.md): a cheap
# guard against a file dropped in the wrong checklist row. Documents with no
# entry here (forms, IDs) skip this check rather than guess at a keyword.
_SLOT_KEYWORDS: dict[str, tuple[str, ...]] = {
    "obo_10_locational_clearance": ("locational clearance",),
    "obo_12_barangay_clearance": ("barangay",),
    "obo_13_hoa_clearance": ("homeowners", "homeowner's association", "no homeowners"),
    "obo_14_tct": ("transfer certificate of title", "tct"),
    "obo_15_tax_declaration_lot": ("tax declaration",),
    "obo_16_tax_clearance_lot": ("tax clearance",),
    "obo_17_deed_of_absolute_sale": ("deed of absolute sale",),
    "obo_18_consent_and_authority": ("consent and authority",),
    "obo_19_contract_of_lease_lot": ("contract of lease",),
    "obo_20_occupancy_certificate": ("occupancy",),
    "obo_21_tax_declaration_and_clearance_building": ("tax declaration", "tax clearance"),
    "obo_24_special_power_of_attorney": ("special power of attorney",),
}

_NAME_PUNCTUATION = re.compile(r"[.,]")
_MIDDLE_INITIAL = re.compile(r"\b[a-z]\b")
_ADDRESS_PUNCTUATION = re.compile(r"[^\w\s]")

_DATE_FORMATS = (
    "%B %d, %Y",
    "%b %d, %Y",
    "%B %d %Y",
    "%m/%d/%Y",
    "%m-%d-%Y",
    "%Y-%m-%d",
)


@dataclass(frozen=True)
class UploadedDocument:
    """One upload, tagged with the checklist slot (document id) it was
    dropped into. No AI classification — the slot tells us what the file is
    meant to be (CLOSED-doc-slots.md)."""

    slot_id: str
    filename: str
    content: bytes


def _normalise_name(name: str) -> str:
    cleaned = _NAME_PUNCTUATION.sub("", name).lower()
    cleaned = _MIDDLE_INITIAL.sub("", cleaned)
    return " ".join(cleaned.split())


def _normalise_address(address: str) -> str:
    cleaned = _ADDRESS_PUNCTUATION.sub(" ", address).lower()
    return " ".join(cleaned.split())


def _names_match(a: str, b: str) -> bool:
    na, nb = _normalise_name(a), _normalise_name(b)
    return bool(na) and bool(nb) and (na == nb or na in nb or nb in na)


def _addresses_match(a: str, b: str) -> bool:
    na, nb = _normalise_address(a), _normalise_address(b)
    return bool(na) and bool(nb) and (na == nb or na in nb or nb in na)


def _parse_date(raw: str) -> date | None:
    candidate = raw.strip()
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(candidate, fmt).replace(tzinfo=UTC).date()
        except ValueError:
            continue
    return None


def _is_annual_expiry(doc: DocumentRequirement) -> bool:
    """Only check expiry where the catalog states a concrete rule ('Annual').
    Documents T1 left unspecified (e.g. barangay clearance) are skipped
    rather than assigned an invented window — CLOSED-doc-reading.md."""
    return bool(doc.expires) and "annual" in (doc.expiry_note or "").lower()


def _expected_owner_name(applicant: ApplicantAnswers) -> str:
    if not applicant.is_registered_owner and applicant.registered_owner_name:
        return applicant.registered_owner_name
    return applicant.full_name


def assess_permit_documents(
    *,
    applicant: ApplicantAnswers,
    build: PermitBuildSpec,
    property_address: str,
    uploads: tuple[UploadedDocument, ...],
    client: DocumentIntakeClient,
) -> PermitAssessmentResponseSchema:
    catalog = load_catalog()
    track = resolve_track(applicant.solar_in_original_permit)
    docs = required_documents(applicant, catalog)
    permits = required_permits(applicant, catalog)
    eligibility = check_net_metering_eligibility(build)

    upload_by_slot = {upload.slot_id: upload for upload in uploads}
    expected_owner_name = _expected_owner_name(applicant)

    findings: list[PermitFindingSchema] = []
    checklist: list[PermitDocumentChecklistItemSchema] = []
    extracted_owner_names: list[tuple[str, str]] = []  # (document_id, raw name)

    for doc in docs:
        upload = upload_by_slot.get(doc.id)

        # 1. Presence
        if upload is None:
            findings.append(
                PermitFindingSchema(
                    document_id=doc.id,
                    category="presence",
                    severity="blocking",
                    message=f"{doc.title} has not been uploaded yet.",
                )
            )
            checklist.append(
                PermitDocumentChecklistItemSchema(
                    document_id=doc.id,
                    title=doc.title,
                    status="missing",
                    expires=doc.expires,
                    unverified=doc.unverified,
                )
            )
            continue

        text = extract_document_text(upload.filename, upload.content)

        # 3. Unreadable — never a silent pass.
        if not text.strip():
            findings.append(
                PermitFindingSchema(
                    document_id=doc.id,
                    category="unreadable",
                    severity="blocking",
                    message=(
                        f"{doc.title} could not be read (likely a scan or photo). "
                        "Needs manual review."
                    ),
                )
            )
            checklist.append(
                PermitDocumentChecklistItemSchema(
                    document_id=doc.id,
                    title=doc.title,
                    status="needs_review",
                    expires=doc.expires,
                    unverified=doc.unverified,
                )
            )
            continue

        checklist.append(
            PermitDocumentChecklistItemSchema(
                document_id=doc.id,
                title=doc.title,
                status="uploaded",
                expires=doc.expires,
                unverified=doc.unverified,
            )
        )

        # 2. Wrong document in slot
        keywords = _SLOT_KEYWORDS.get(doc.id)
        if keywords and not any(keyword in text.lower() for keyword in keywords):
            findings.append(
                PermitFindingSchema(
                    document_id=doc.id,
                    category="wrong_slot",
                    severity="warning",
                    message=(
                        f"The file uploaded for {doc.title} does not mention any of "
                        f"the expected terms ({', '.join(keywords)}). Check it is the "
                        "right document."
                    ),
                )
            )

        fields = client.extract_document_fields(document_text=text)

        # 4. Address mismatch
        if "property_address" in doc.cross_check_fields:
            extracted_address = fields.get("property_address")
            if extracted_address and not _addresses_match(extracted_address, property_address):
                findings.append(
                    PermitFindingSchema(
                        document_id=doc.id,
                        category="address_mismatch",
                        severity="warning",
                        message=(
                            f"{doc.title} lists the address '{extracted_address}', which "
                            f"does not match the property address '{property_address}'."
                        ),
                    )
                )

        # 5. Name mismatch (against applicant; cross-document check below)
        if "registered_owner_name" in doc.cross_check_fields:
            extracted_name = fields.get("registered_owner_name")
            if extracted_name:
                extracted_owner_names.append((doc.id, extracted_name))
                if not _names_match(extracted_name, expected_owner_name):
                    findings.append(
                        PermitFindingSchema(
                            document_id=doc.id,
                            category="name_mismatch",
                            severity="warning",
                            message=(
                                f"{doc.title} lists the owner as '{extracted_name}', which "
                                f"does not match the applicant name '{expected_owner_name}'."
                            ),
                        )
                    )

        # 6. Expiry
        if "issue_date" in doc.cross_check_fields and _is_annual_expiry(doc):
            raw_issue_date = fields.get("issue_date")
            issue_date = _parse_date(raw_issue_date) if raw_issue_date else None
            if issue_date and issue_date.year != datetime.now(tz=UTC).date().year:
                findings.append(
                    PermitFindingSchema(
                        document_id=doc.id,
                        category="expiry",
                        severity="warning",
                        message=(
                            f"{doc.title} was issued {issue_date.isoformat()} "
                            f"({doc.expiry_note}). It may no longer be valid for "
                            "this year's application."
                        ),
                    )
                )

    # 5b. Name mismatch across documents
    for i, (doc_id_a, name_a) in enumerate(extracted_owner_names):
        for doc_id_b, name_b in extracted_owner_names[i + 1 :]:
            if not _names_match(name_a, name_b):
                findings.append(
                    PermitFindingSchema(
                        document_id=None,
                        category="name_mismatch",
                        severity="warning",
                        message=(
                            f"Owner name differs between documents: '{name_a}' "
                            f"(from {doc_id_a}) versus '{name_b}' (from {doc_id_b})."
                        ),
                    )
                )

    packet_status = (
        "ready"
        if not any(f.severity == "blocking" for f in findings)
        else "incomplete"
    )
    summary = client.summarize_findings(findings=tuple(f.message for f in findings))

    return PermitAssessmentResponseSchema(
        track=track,
        net_metering_eligibility=NetMeteringEligibilitySchema(
            satisfied=eligibility.satisfied,
            system_kwp=eligibility.system_kwp,
            cap_kwp=eligibility.cap_kwp,
            legal_basis=eligibility.legal_basis,
            source_url=eligibility.source_url,
        ),
        permits=tuple(
            PermitRequirementSchema(
                id=permit.id,
                name=permit.name,
                issuing_agency=permit.issuing_agency,
                unverified=permit.unverified,
                unverified_notes=permit.unverified_notes,
            )
            for permit in permits
        ),
        documents=tuple(checklist),
        findings=tuple(findings),
        packet_status=packet_status,
        summary=summary,
    )
