# Defines permit compliance REST API endpoints.

import json

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.core.config import Settings, get_settings
from app.domain.permits.entities import ApplicantAnswers, PermitBuildSpec
from app.features.permits.chat import run_permit_chat_turn
from app.features.permits.intake import UploadedDocument, assess_permit_documents
from app.features.permits.schemas import (
    PermitAssessmentRequestSchema,
    PermitAssessmentResponseSchema,
    PermitChatRequestSchema,
    PermitChatResponseSchema,
)
from app.integrations.ai import get_document_intake_client, get_permit_chat_client

router = APIRouter(prefix="/permits", tags=["permits"])

DependsSettings = Depends(get_settings)

# Assess and chat both carry every document uploaded so far in one request.
# Vercel refuses bodies over 4.5 MB before the app runs; enforcing the same
# packet limit here keeps other deployments consistent with it.
MAX_PERMIT_UPLOAD_BYTES = 4 * 1024 * 1024


async def _read_uploads(
    slot_ids: list[str],
    files: list[UploadFile],
) -> list[UploadedDocument]:
    if len(slot_ids) != len(files):
        raise HTTPException(status_code=400, detail="slot_ids and files must pair 1:1.")

    uploads: list[UploadedDocument] = []
    total_bytes = 0
    for slot_id, file in zip(slot_ids, files, strict=True):
        content = await file.read()
        total_bytes += len(content)
        if total_bytes > MAX_PERMIT_UPLOAD_BYTES:
            raise HTTPException(
                status_code=413,
                detail="Your documents are over 4 MB in total. Upload smaller photos or PDFs.",
            )
        uploads.append(
            UploadedDocument(slot_id=slot_id, filename=file.filename or slot_id, content=content)
        )
    return uploads


@router.post("/assess", response_model=PermitAssessmentResponseSchema)
async def assess_permits(
    request: str = Form(...),
    slot_ids: list[str] = Form(default=[]),  # noqa: B008
    files: list[UploadFile] = File(default=[]),  # noqa: B008
    settings: Settings = DependsSettings,
) -> PermitAssessmentResponseSchema:
    try:
        payload = PermitAssessmentRequestSchema.model_validate(json.loads(request))
    except (json.JSONDecodeError, ValueError) as error:
        raise HTTPException(status_code=400, detail="Invalid request payload.") from error

    uploads = await _read_uploads(slot_ids, files)

    applicant = ApplicantAnswers(
        solar_in_original_permit=payload.applicant.solar_in_original_permit,
        full_name=payload.applicant.full_name,
        is_registered_owner=payload.applicant.is_registered_owner,
        registered_owner_name=payload.applicant.registered_owner_name,
        delegates_filing_to_representative=payload.applicant.delegates_filing_to_representative,
    )
    build = PermitBuildSpec(system_kwp=payload.system_kwp, build_id=payload.build_id)

    return assess_permit_documents(
        applicant=applicant,
        build=build,
        property_address=payload.property_address,
        uploads=tuple(uploads),
        documents=payload.extracted_documents,
        client=get_document_intake_client(settings),
    )


@router.post("/chat", response_model=PermitChatResponseSchema)
async def permit_chat_turn(
    request: str = Form(...),
    slot_ids: list[str] = Form(default=[]),  # noqa: B008
    files: list[UploadFile] = File(default=[]),  # noqa: B008
    settings: Settings = DependsSettings,
) -> PermitChatResponseSchema:
    try:
        payload = PermitChatRequestSchema.model_validate(json.loads(request))
    except (json.JSONDecodeError, ValueError) as error:
        raise HTTPException(status_code=400, detail="Invalid request payload.") from error

    uploads = await _read_uploads(slot_ids, files)

    applicant = ApplicantAnswers(
        solar_in_original_permit=payload.applicant.solar_in_original_permit,
        full_name=payload.applicant.full_name,
        is_registered_owner=payload.applicant.is_registered_owner,
        registered_owner_name=payload.applicant.registered_owner_name,
        delegates_filing_to_representative=payload.applicant.delegates_filing_to_representative,
    )
    build = PermitBuildSpec(system_kwp=payload.system_kwp, build_id=payload.build_id)

    return run_permit_chat_turn(
        applicant=applicant,
        build=build,
        property_address=payload.property_address,
        uploads=tuple(uploads),
        user_text=payload.user_text,
        chat_client=get_permit_chat_client(settings),
        intake_client=get_document_intake_client(settings),
        documents=payload.extracted_documents,
    )
