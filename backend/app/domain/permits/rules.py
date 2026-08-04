# Defines pure functions mapping build spec and applicant answers to the
# resolved track, required documents, required permits, and the submission
# packet. No framework imports (hard rule 3).

from app.domain.permits.catalog import (
    DocumentRequirement,
    PermitCatalog,
    PermitRequirement,
    PermitTrack,
    documents_for_track,
    load_catalog,
    permits_for_track,
)
from app.domain.permits.entities import (
    ApplicantAnswers,
    ApplicantBlock,
    DocumentManifestEntry,
    NetMeteringEligibilityCheck,
    PermitBuildSpec,
    SubmissionPacket,
)

SCHEMA_VERSION = "1.0"

NET_METERING_CAP_KWP = 100.0
NET_METERING_LEGAL_BASIS = (
    "JMC 001-2026 Section 5.3, citing DOE Net-Metering Guidebook 2022 p.18, "
    "tracing to RA 9513 Section 4 (distributed generation up to 100 kW)."
)
NET_METERING_SOURCE_URL = (
    "https://www.dilg.gov.ph/PDF_File/issuances/joint_circulars/"
    "dilg-joincircular-2026114_6a8ceeefa2.pdf"
)


def resolve_track(solar_in_original_permit: str) -> PermitTrack:
    """Yes selects the streamlined JMC 001-2026 track. No or not_sure defaults
    to retrofit — the common case and the safe direction to be wrong in."""
    return "streamlined" if solar_in_original_permit == "yes" else "retrofit"


def check_net_metering_eligibility(build: PermitBuildSpec) -> NetMeteringEligibilityCheck:
    """system_kwp <= 100 net-metering eligibility per JMC 001-2026 Section 5.3.
    Residential builds always pass; this is surfaced as a satisfied check, not
    branched on."""
    return NetMeteringEligibilityCheck(
        satisfied=build.system_kwp <= NET_METERING_CAP_KWP,
        system_kwp=build.system_kwp,
        cap_kwp=NET_METERING_CAP_KWP,
        legal_basis=NET_METERING_LEGAL_BASIS,
        source_url=NET_METERING_SOURCE_URL,
    )


def required_documents(
    applicant: ApplicantAnswers, catalog: PermitCatalog | None = None
) -> list[DocumentRequirement]:
    """Maps (track, owner-mismatch, delegation) to the homeowner-owed document
    list.

    The owner_mismatch condition (OBO items 17/18/19) is required only when
    the applicant is not the registered owner; the applicant picks which of
    those instruments applies, so all remain listed as alternatives.

    The owner_mismatch_or_delegation condition (OBO item 24, the notarized
    SPA) fires on either of two independent triggers per the OBO checklist's
    "if applicant acts via representative" line: the applicant not being the
    registered owner, OR the registered owner delegating the act of filing to
    a representative (e.g. their installer) while still being the owner. The
    second trigger is [UNVERIFIED as Cebu-OBO-specific policy] — see
    .wayfinder/cebu-permit-submission-research.md, "Who may file".
    """
    cat = catalog or load_catalog()
    track = resolve_track(applicant.solar_in_original_permit)
    docs = documents_for_track(track, cat)
    owner_mismatch = not applicant.is_registered_owner
    needs_authorization = owner_mismatch or applicant.delegates_filing_to_representative

    def _included(doc: DocumentRequirement) -> bool:
        if doc.condition == "owner_mismatch":
            return owner_mismatch
        if doc.condition == "owner_mismatch_or_delegation":
            return needs_authorization
        return True

    return [doc for doc in docs if _included(doc)]


def required_permits(
    applicant: ApplicantAnswers, catalog: PermitCatalog | None = None
) -> list[PermitRequirement]:
    cat = catalog or load_catalog()
    track = resolve_track(applicant.solar_in_original_permit)
    return permits_for_track(track, cat)


def build_submission_packet(
    build: PermitBuildSpec,
    applicant: ApplicantAnswers,
    catalog: PermitCatalog | None = None,
) -> SubmissionPacket:
    """Builds the versioned eGov payload shape. Posting it is T2's adapter."""
    cat = catalog or load_catalog()
    track = resolve_track(applicant.solar_in_original_permit)
    documents = required_documents(applicant, cat)
    permits = required_permits(applicant, cat)
    eligibility = check_net_metering_eligibility(build)

    return SubmissionPacket(
        schema_version=SCHEMA_VERSION,
        track=track,
        applicant=ApplicantBlock(
            full_name=applicant.full_name,
            is_registered_owner=applicant.is_registered_owner,
            registered_owner_name=applicant.registered_owner_name,
        ),
        build_ref=build.build_id or f"system_kwp:{build.system_kwp}",
        net_metering_eligibility=eligibility,
        permits=tuple(permits),
        documents=tuple(
            DocumentManifestEntry(
                document_id=doc.id,
                title=doc.title,
                status="pending",
                cross_check_fields=doc.cross_check_fields,
                expires=doc.expires,
            )
            for doc in documents
        ),
    )
