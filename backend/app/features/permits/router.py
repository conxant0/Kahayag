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

    if len(slot_ids) != len(files):
        raise HTTPException(status_code=400, detail="slot_ids and files must pair 1:1.")

    uploads: list[UploadedDocument] = []
    for slot_id, file in zip(slot_ids, files, strict=True):
        content = await file.read()
        uploads.append(
            UploadedDocument(slot_id=slot_id, filename=file.filename or slot_id, content=content)
        )

    applicant = ApplicantAnswers(
        solar_in_original_permit=payload.applicant.solar_in_original_permit,
        full_name=payload.applicant.full_name,
        is_registered_owner=payload.applicant.is_registered_owner,
        registered_owner_name=payload.applicant.registered_owner_name,
    )
    build = PermitBuildSpec(system_kwp=payload.system_kwp, build_id=payload.build_id)

    return assess_permit_documents(
        applicant=applicant,
        build=build,
        property_address=payload.property_address,
        uploads=tuple(uploads),
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

    if len(slot_ids) != len(files):
        raise HTTPException(status_code=400, detail="slot_ids and files must pair 1:1.")

    uploads: list[UploadedDocument] = []
    for slot_id, file in zip(slot_ids, files, strict=True):
        content = await file.read()
        uploads.append(
            UploadedDocument(slot_id=slot_id, filename=file.filename or slot_id, content=content)
        )

    applicant = ApplicantAnswers(
        solar_in_original_permit=payload.applicant.solar_in_original_permit,
        full_name=payload.applicant.full_name,
        is_registered_owner=payload.applicant.is_registered_owner,
        registered_owner_name=payload.applicant.registered_owner_name,
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
    )
