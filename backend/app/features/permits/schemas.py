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
    # Empty until the homeowner submits the form or the chat records a name.
    full_name: str = ""
    is_registered_owner: StrictBool
    registered_owner_name: str | None = None
    # Optional, defaults False for backward compatibility with callers
    # (including the current frontend) that don't send it yet.
    delegates_filing_to_representative: StrictBool = False


class ExtractedDocumentSchema(ContractModel):
    """One upload after it has been read: its text and the fields the intake
    client pulled from it. Returned with every assessment and sent back by
    the browser, so a document is read (and the AI called) once per upload
    rather than on every assess or chat request. Only the homeowner's own
    checklist depends on it, and every verdict is still recomputed from it
    deterministically. An empty slot_id means the file is not in a slot."""

    slot_id: str = ""
    filename: str
    text: str
    fields: dict[str, str | None]


class PermitAssessmentRequestSchema(ContractModel):
    applicant: ApplicantAnswersSchema
    system_kwp: StrictFloat = Field(gt=0)
    build_id: str | None = None
    property_address: str = Field(min_length=1)
    extracted_documents: tuple[ExtractedDocumentSchema, ...] = ()


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
    issuing_agency: str
    steps: tuple[str, ...]
    prerequisites: tuple[str, ...]


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
    extracted_documents: tuple[ExtractedDocumentSchema, ...] = ()


class PermitChatRequestSchema(ContractModel):
    applicant: ApplicantAnswersSchema
    system_kwp: StrictFloat = Field(gt=0)
    build_id: str | None = None
    property_address: str = Field(min_length=1)
    user_text: str = Field(min_length=1)
    extracted_documents: tuple[ExtractedDocumentSchema, ...] = ()


class PermitChatResponseSchema(ContractModel):
    reply: str
    applicant: ApplicantAnswersSchema
    assessment: PermitAssessmentResponseSchema
