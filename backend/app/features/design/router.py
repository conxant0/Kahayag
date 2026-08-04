# Defines design REST API endpoints including the thin agent loop.

import json

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.core.config import Settings, get_settings
from app.features.design.agent import explain_design_session, run_design_agent_turn
from app.features.design.quote_audit import audit_uploaded_quote
from app.features.design.schemas import (
    AgentDesignRequest,
    AgentDesignResponse,
    BootstrapDesignRequest,
    DesignSessionSchema,
    ExplainDesignRequest,
    ExplainDesignResponse,
    GenerateQuotationRequest,
    MutateDesignRequest,
    OptimiseDesignRequest,
    QuotationDocumentSchema,
    QuoteAuditResponseSchema,
    RejectionReasonSchema,
)
from app.features.design.service import (
    NoValidDesignError,
    bootstrap_design_session,
    generate_quotation,
    get_rejections_for_solve,
    mutate_design_session,
    optimise_design_session,
)
from app.integrations.ai import get_design_agent_client, get_quote_auditor_client

router = APIRouter(prefix="/designs", tags=["designs"])

DependsSettings = Depends(get_settings)


@router.post("/bootstrap", response_model=DesignSessionSchema)
def bootstrap_design(request: BootstrapDesignRequest) -> DesignSessionSchema:
    try:
        return bootstrap_design_session(request)
    except NoValidDesignError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.post("/optimise", response_model=DesignSessionSchema)
def optimise_design(request: OptimiseDesignRequest) -> DesignSessionSchema:
    try:
        return optimise_design_session(request)
    except NoValidDesignError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.post("/mutate", response_model=DesignSessionSchema)
def mutate_design(request: MutateDesignRequest) -> DesignSessionSchema:
    try:
        return mutate_design_session(request)
    except NoValidDesignError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get(
    "/solves/{solve_id}/rejections",
    response_model=tuple[RejectionReasonSchema, ...],
)
def list_solve_rejections(solve_id: str) -> tuple[RejectionReasonSchema, ...]:
    return get_rejections_for_solve(solve_id)


@router.post("/quotation/{build_id}", response_model=QuotationDocumentSchema)
def create_quotation(
    build_id: str,
    request: GenerateQuotationRequest,
) -> QuotationDocumentSchema:
    if request.build_id != build_id:
        raise HTTPException(status_code=400, detail="build_id path/body mismatch.")
    try:
        return generate_quotation(request)
    except NoValidDesignError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.post("/agent", response_model=AgentDesignResponse)
def design_agent_turn(
    request: AgentDesignRequest,
    settings: Settings = DependsSettings,
) -> AgentDesignResponse:
    try:
        return run_design_agent_turn(
            request,
            client=get_design_agent_client(settings),
        )
    except NoValidDesignError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.post("/explain", response_model=ExplainDesignResponse)
def explain_design(
    request: ExplainDesignRequest,
    settings: Settings = DependsSettings,
) -> ExplainDesignResponse:
    return explain_design_session(
        request,
        client=get_design_agent_client(settings),
    )


@router.post("/quote-audit", response_model=QuoteAuditResponseSchema)
async def audit_quote(
    session: str = Form(...),
    file: UploadFile = File(...),  # noqa: B008
    settings: Settings = DependsSettings,
) -> QuoteAuditResponseSchema:
    try:
        session_payload = DesignSessionSchema.model_validate(json.loads(session))
    except (json.JSONDecodeError, ValueError) as error:
        raise HTTPException(status_code=400, detail="Invalid session payload.") from error

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        return audit_uploaded_quote(
            filename=file.filename or "upload.txt",
            content=content,
            session=session_payload,
            client=get_quote_auditor_client(settings),
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
