import re
from datetime import datetime, timezone
from decimal import Decimal

from reportlab.lib.units import mm
from reportlab.platypus import CondPageBreak, Spacer, Table

from app.features.assessment.schemas import CompletedAssessment
from app.features.design.schemas import DesignBuildSchema, DesignComponentSchema
from app.features.design.service import compose_quotation
from app.features.reports.schemas import GeoPoint, PanelPolygon, ReportPDFRequest
from app.features.reports.service import (
    build_projection,
    build_sensitivity_cases,
    resolve_narrative,
)
from app.features.reports.validator import build_report_input
from app.integrations.pdf.reportlab_renderer import (
    _kwh,
    _metric_strip,
    _notice,
    _page_title,
    _projection_table,
    _RoofLayout,
    _styles,
    render_report_pdf,
)


def test_renderer_returns_pdf_for_a_complete_preliminary_report(
    completed_assessment,
) -> None:
    report = build_report_input(completed_assessment)
    roof = (
        GeoPoint(latitude="10.31570", longitude="123.88540"),
        GeoPoint(latitude="10.31582", longitude="123.88540"),
        GeoPoint(latitude="10.31582", longitude="123.88555"),
        GeoPoint(latitude="10.31570", longitude="123.88555"),
    )
    panel = PanelPolygon(corners=(roof[0], roof[1], roof[2], roof[3]))
    request = ReportPDFRequest(
        assessment=completed_assessment,
        roof_polygon=roof,
        panel_polygons=(panel,) * completed_assessment.recommendation.panel_count,
    )

    pdf = render_report_pdf(
        request=request,
        narrative=resolve_narrative(report, None),
        projection=build_projection(report),
        sensitivity=build_sensitivity_cases(report),
        satellite=None,
        report_id="KAH-20260731-1234ABCD",
        generated_at=datetime(2026, 7, 31, tzinfo=timezone.utc),
    )

    assert pdf.startswith(b"%PDF")
    assert len(pdf) > 10_000
    assert len(re.findall(rb"/Type\s*/Page\b", pdf)) <= 8


def test_renderer_adds_a_page_for_the_chosen_design_and_quotation(
    completed_assessment,
) -> None:
    report = build_report_input(completed_assessment)
    roof = (
        GeoPoint(latitude="10.31570", longitude="123.88540"),
        GeoPoint(latitude="10.31582", longitude="123.88540"),
        GeoPoint(latitude="10.31582", longitude="123.88555"),
        GeoPoint(latitude="10.31570", longitude="123.88555"),
    )
    panel = PanelPolygon(corners=(roof[0], roof[1], roof[2], roof[3]))
    build = DesignBuildSchema(
        id="ea12b6f3-demo",
        label="Balanced build",
        tags=(),
        combo_id="combo-1",
        solve_id="solve-1",
        system_kwp=5.5,
        panel_count=10,
        inverter_kw=5.0,
        battery_kwh=None,
        monthly_savings_php=4850.0,
        annual_savings_php=58200.0,
        payback_years=4.8,
        total_investment_php=716576.0,
        subtotal_php=639800.0,
        vat_php=76776.0,
        inverter_utilisation_pct=91.0,
        fit_score=88.0,
        co2_tonnes_avoided_yearly=3.2,
        insight="Solver-authored insight.",
        components=(
            DesignComponentSchema(
                slot="panel",
                brand="Brand",
                model="Model 550",
                summary="PV modules",
                qty=10.0,
                unit="pcs",
                unit_price_php=63980.0,
                line_total_php=639800.0,
                warranty_note="12-year product warranty",
            ),
        ),
        source="ai_suggested",
    )

    def render(design_build):
        request = ReportPDFRequest(
            assessment=completed_assessment,
            roof_polygon=roof,
            panel_polygons=(panel,) * completed_assessment.recommendation.panel_count,
            design_build=design_build,
        )
        return render_report_pdf(
            request=request,
            narrative=resolve_narrative(report, None),
            projection=build_projection(report),
            sensitivity=build_sensitivity_cases(report),
            satellite=None,
            quotation=compose_quotation(design_build) if design_build else None,
            report_id="KAH-20260731-1234ABCD",
            generated_at=datetime(2026, 7, 31, tzinfo=timezone.utc),
        )

    without_design = render(None)
    with_design = render(build)

    assert with_design.startswith(b"%PDF")

    def pages(pdf: bytes) -> int:
        return len(re.findall(rb"/Type\s*/Page\b", pdf))

    assert pages(with_design) > pages(without_design)


def test_roof_layout_keeps_its_rendering_dimensions(completed_assessment) -> None:
    roof = (
        GeoPoint(latitude="10.31570", longitude="123.88540"),
        GeoPoint(latitude="10.31582", longitude="123.88540"),
        GeoPoint(latitude="10.31582", longitude="123.88555"),
        GeoPoint(latitude="10.31570", longitude="123.88555"),
    )
    panel = PanelPolygon(corners=roof)
    request = ReportPDFRequest(
        assessment=completed_assessment,
        roof_polygon=roof,
        panel_polygons=(panel,) * completed_assessment.recommendation.panel_count,
    )

    width, height = _RoofLayout(request, None).wrap(500, 500)

    assert width > 0
    assert height > 0


def test_roof_layout_supports_a_compact_cover_size(completed_assessment) -> None:
    roof = (
        GeoPoint(latitude="10.31570", longitude="123.88540"),
        GeoPoint(latitude="10.31582", longitude="123.88540"),
        GeoPoint(latitude="10.31582", longitude="123.88555"),
        GeoPoint(latitude="10.31570", longitude="123.88555"),
    )
    request = ReportPDFRequest(
        assessment=completed_assessment,
        roof_polygon=roof,
        panel_polygons=(PanelPolygon(corners=roof),),
    )

    width, height = _RoofLayout(request, None, width=176 * mm, height=62 * mm).wrap(500, 500)

    assert width == 176 * mm
    assert height == 62 * mm


def test_section_heading_stays_with_following_content() -> None:
    title = _page_title("Energy analysis", _styles())

    assert len(title) == 2
    assert isinstance(title[0], Table)
    assert title[0].getKeepWithNext()
    assert isinstance(title[1], Spacer)
    assert title[1].getKeepWithNext()
    assert title[1].height == 2 * mm


def test_metric_strip_uses_one_card_per_metric() -> None:
    metrics = _metric_strip(
        [
            ("System", "8 panels / 3.60 kWp"),
            ("Annual generation", "4,730 kWh"),
            ("Planning cost", "PHP 180,000 - PHP 252,000"),
            ("Simple payback", "9.5 years"),
        ]
    )

    assert isinstance(metrics, Table)
    assert len(metrics._cellvalues) == 2
    assert len(metrics._cellvalues[0]) == 4


def test_projection_table_starts_on_a_page_with_room_for_its_rows() -> None:
    flowables = _projection_table([])

    assert isinstance(flowables[0], CondPageBreak)


def test_notice_uses_the_same_content_width_as_tables() -> None:
    notice = _notice("Installer verification required.", _styles())

    width, _height = notice.wrap(176 * mm, 500)

    assert isinstance(notice, Table)
    assert width == 176 * mm


def test_kwh_formats_repeating_and_exact_decimals_without_scientific_notation() -> None:
    assert _kwh(Decimal(5000) / Decimal("11.50")) == "434.78 kWh"
    assert _kwh(Decimal(6000) / Decimal("12.00")) == "500.00 kWh"
    assert _kwh(Decimal(5000) / Decimal("10.00")) == "500.00 kWh"


def test_renderer_accepts_bill_derived_consumption_with_null_raw_input(
    completed_assessment_data,
) -> None:
    completed_assessment_data["inputs"]["monthly_consumption_kwh"] = None
    completed_assessment_data["consumption_source"] = "bill"
    completed_assessment_data["estimated_monthly_consumption_kwh"] = "416.67"
    assessment = CompletedAssessment.model_validate(completed_assessment_data)

    report = build_report_input(assessment)
    roof = (
        GeoPoint(latitude="10.31570", longitude="123.88540"),
        GeoPoint(latitude="10.31582", longitude="123.88540"),
        GeoPoint(latitude="10.31582", longitude="123.88555"),
        GeoPoint(latitude="10.31570", longitude="123.88555"),
    )
    panel = PanelPolygon(corners=(roof[0], roof[1], roof[2], roof[3]))
    request = ReportPDFRequest(
        assessment=assessment,
        roof_polygon=roof,
        panel_polygons=(panel,) * assessment.recommendation.panel_count,
    )

    pdf = render_report_pdf(
        request=request,
        narrative=resolve_narrative(report, None),
        projection=build_projection(report),
        sensitivity=build_sensitivity_cases(report),
        satellite=None,
        report_id="KAH-20260731-BILL",
        generated_at=datetime(2026, 7, 31, tzinfo=timezone.utc),
    )

    assert pdf.startswith(b"%PDF")
