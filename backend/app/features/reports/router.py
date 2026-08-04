# Defines report preview and PDF API endpoint boundaries.
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from app.core.config import Settings, get_settings
from app.features.design.service import compose_quotation
from app.features.reports.schemas import ReportPDFRequest
from app.features.reports.service import (
    build_projection,
    build_sensitivity_cases,
    new_report_id,
    resolve_narrative,
)
from app.features.reports.validator import build_report_input
from app.integrations.ai import get_ai_provider
from app.integrations.maps.static_map import fetch_static_map
from app.integrations.pdf.reportlab_renderer import render_report_pdf

router = APIRouter()

DependsSettings = Depends(get_settings)


@router.post("/reports/pdf")
def download_report(
    request: ReportPDFRequest,
    settings: Settings = DependsSettings,
) -> Response:
    try:
        request.validate_panel_count()
        request.validate_design_build()
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    try:
        report = build_report_input(request.assessment)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    narrative = resolve_narrative(report, get_ai_provider(settings).write(report))
    satellite = fetch_static_map(
        request.roof_polygon,
        google_maps_api_key=settings.google_maps_api_key,
    )
    # Recomposed from the build by the same domain path /quotation uses, so
    # the printed quote is authored server-side rather than trusted as sent.
    quotation = (
        compose_quotation(request.design_build) if request.design_build else None
    )
    pdf = render_report_pdf(
        request=request,
        narrative=narrative,
        projection=build_projection(report),
        sensitivity=build_sensitivity_cases(report),
        satellite=satellite,
        quotation=quotation,
        report_id=new_report_id(report.property.assessment_date),
        generated_at=datetime.now(timezone.utc),
    )
    filename = f"kahayag-solar-report-{report.property.assessment_date.isoformat()}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
