# Defines design REST API endpoints (no agent loop).

from fastapi import APIRouter, HTTPException

from app.features.design.schemas import (
    BootstrapDesignRequest,
    DesignSessionSchema,
    GenerateQuotationRequest,
    MutateDesignRequest,
    OptimiseDesignRequest,
    QuotationDocumentSchema,
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

router = APIRouter(prefix="/designs", tags=["designs"])


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
