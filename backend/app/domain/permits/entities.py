# Defines permit domain entities: applicant inputs, build-side facts, and the
# versioned submission packet value object.

from dataclasses import dataclass
from typing import Literal

from app.domain.permits.catalog import CrossCheckField, PermitRequirement, PermitTrack

SolarInOriginalPermitAnswer = Literal["yes", "no", "not_sure"]
DocumentStatus = Literal["pending"]


@dataclass(frozen=True)
class ApplicantAnswers:
    """The three applicant inputs from CLOSED-applicant-inputs.md."""

    solar_in_original_permit: SolarInOriginalPermitAnswer
    full_name: str
    is_registered_owner: bool
    registered_owner_name: str | None = None


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
