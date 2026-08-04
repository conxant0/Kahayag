# Defines permit domain entities: applicant inputs, build-side facts, and the
# versioned submission packet value object.

from dataclasses import dataclass
from typing import Literal

from app.domain.permits.catalog import CrossCheckField, PermitRequirement, PermitTrack

SolarInOriginalPermitAnswer = Literal["yes", "no", "not_sure"]
DocumentStatus = Literal["pending"]


@dataclass(frozen=True)
class ApplicantAnswers:
    """The applicant inputs from CLOSED-applicant-inputs.md, plus the
    delegation answer added for the SPA fix (see rules.py)."""

    solar_in_original_permit: SolarInOriginalPermitAnswer
    full_name: str
    is_registered_owner: bool
    registered_owner_name: str | None = None
    # Optional, defaults False so existing callers (including the frontend,
    # which cannot be updated yet) stay compatible. True means the registered
    # owner delegates the act of filing to a representative (e.g. their
    # installer) while still being the owner — distinct from is_registered_owner
    # being False.
    delegates_filing_to_representative: bool = False


@dataclass(frozen=True)
class PermitBuildSpec:
    """The build-side facts the permit rules need, decoupled from the design
    feature's pydantic schema so this domain stays framework-free."""

    system_kwp: float
    build_id: str | None = None


@dataclass(frozen=True)
class NetMeteringEligibilityCheck:
    satisfied: bool
    system_kwp: float
    cap_kwp: float
    legal_basis: str
    source_url: str


@dataclass(frozen=True)
class DocumentManifestEntry:
    document_id: str
    title: str
    status: DocumentStatus
    cross_check_fields: tuple[CrossCheckField, ...]
    expires: bool | None


@dataclass(frozen=True)
class ApplicantBlock:
    full_name: str
    is_registered_owner: bool
    registered_owner_name: str | None


@dataclass(frozen=True)
class SubmissionPacket:
    """Versioned eGov payload shape. Posting it is T2's adapter; this is domain
    work only."""

    schema_version: str
    track: PermitTrack
    applicant: ApplicantBlock
    build_ref: str
    net_metering_eligibility: NetMeteringEligibilityCheck
    permits: tuple[PermitRequirement, ...]
    documents: tuple[DocumentManifestEntry, ...]
