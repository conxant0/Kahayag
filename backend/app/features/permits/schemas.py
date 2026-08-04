# Defines permit compliance feature API schemas.

from typing import Literal

from pydantic import Field, StrictBool, StrictFloat

from app.shared.schemas import ContractModel

SolarInOriginalPermitAnswer = Literal["yes", "no", "not_sure"]
PermitTrackSchema = Literal["streamlined", "retrofit"]
DocumentSlotStatus = Literal["missing", "uploaded", "needs_review"]
FindingCategorySchema = Literal[
    "presence",
    "wrong_slot",
    "unreadable",
    "address_mismatch",
    "name_mismatch",
    "expiry",
]
FindingSeveritySchema = Literal["info", "warning", "blocking"]
PacketStatus = Literal["ready", "incomplete"]


class ApplicantAnswersSchema(ContractModel):
    solar_in_original_permit: SolarInOriginalPermitAnswer
    full_name: str = Field(min_length=1)
    is_registered_owner: StrictBool
    registered_owner_name: str | None = None


class PermitAssessmentRequestSchema(ContractModel):
    applicant: ApplicantAnswersSchema
    system_kwp: StrictFloat = Field(gt=0)
    build_id: str | None = None
    property_address: str = Field(min_length=1)


class PermitFindingSchema(ContractModel):
    document_id: str | None
    category: FindingCategorySchema
    severity: FindingSeveritySchema
    message: str


class PermitDocumentChecklistItemSchema(ContractModel):
    document_id: str
    title: str
    status: DocumentSlotStatus
    expires: StrictBool | None
    unverified: StrictBool


class PermitRequirementSchema(ContractModel):
    id: str
    name: str
    issuing_agency: str
    unverified: StrictBool
    unverified_notes: tuple[str, ...]


class NetMeteringEligibilitySchema(ContractModel):
    satisfied: StrictBool
    system_kwp: StrictFloat
    cap_kwp: StrictFloat
    legal_basis: str
    source_url: str


class PermitAssessmentResponseSchema(ContractModel):
    track: PermitTrackSchema
    net_metering_eligibility: NetMeteringEligibilitySchema
    permits: tuple[PermitRequirementSchema, ...]
    documents: tuple[PermitDocumentChecklistItemSchema, ...]
    findings: tuple[PermitFindingSchema, ...]
    packet_status: PacketStatus
    summary: str
