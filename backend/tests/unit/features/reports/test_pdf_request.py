from decimal import Decimal

import pytest

from app.features.design.schemas import DesignBuildSchema, DesignComponentSchema
from app.features.reports.schemas import GeoPoint, PanelPolygon, ReportPDFRequest


def _design_build(**overrides) -> DesignBuildSchema:
    values = {
        "id": "ea12b6f3-demo",
        "label": "Balanced build",
        "tags": (),
        "combo_id": "combo-1",
        "solve_id": "solve-1",
        "system_kwp": 5.5,
        "panel_count": 10,
        "inverter_kw": 5.0,
        "battery_kwh": None,
        "monthly_savings_php": 4850.0,
        "annual_savings_php": 58200.0,
        "payback_years": 4.8,
        "total_investment_php": 716576.0,
        "subtotal_php": 639800.0,
        "vat_php": 76776.0,
        "inverter_utilisation_pct": 91.0,
        "fit_score": 88.0,
        "co2_tonnes_avoided_yearly": 3.2,
        "insight": "Solver-authored insight.",
        "components": (
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
        "source": "ai_suggested",
    }
    values.update(overrides)
    return DesignBuildSchema(**values)


def _roof() -> tuple[GeoPoint, ...]:
    return (
        GeoPoint(latitude=Decimal("10.31570"), longitude=Decimal("123.88540")),
        GeoPoint(latitude=Decimal("10.31582"), longitude=Decimal("123.88540")),
        GeoPoint(latitude=Decimal("10.31582"), longitude=Decimal("123.88555")),
        GeoPoint(latitude=Decimal("10.31570"), longitude=Decimal("123.88555")),
    )


def _panels(count: int) -> tuple[PanelPolygon, ...]:
    return tuple(
        PanelPolygon(
            corners=(
                GeoPoint(
                    latitude=Decimal("10.31571"),
                    longitude=Decimal("123.88541") + Decimal(index) * Decimal("0.00001"),
                ),
                GeoPoint(
                    latitude=Decimal("10.31573"),
                    longitude=Decimal("123.88541") + Decimal(index) * Decimal("0.00001"),
                ),
                GeoPoint(
                    latitude=Decimal("10.31573"),
                    longitude=Decimal("123.88542") + Decimal(index) * Decimal("0.00001"),
                ),
                GeoPoint(
                    latitude=Decimal("10.31571"),
                    longitude=Decimal("123.88542") + Decimal(index) * Decimal("0.00001"),
                ),
            )
        )
        for index in range(count)
    )


def test_report_request_rejects_panel_geometry_that_disagrees_with_assessment(
    completed_assessment,
) -> None:
    request = ReportPDFRequest(
        assessment=completed_assessment,
        roof_polygon=_roof(),
        panel_polygons=_panels(completed_assessment.recommendation.panel_count - 1),
    )

    with pytest.raises(ValueError, match="panel polygon count"):
        request.validate_panel_count()


def _request_with_build(completed_assessment, build) -> ReportPDFRequest:
    return ReportPDFRequest(
        assessment=completed_assessment,
        roof_polygon=_roof(),
        panel_polygons=_panels(completed_assessment.recommendation.panel_count),
        design_build=build,
    )


def test_report_request_accepts_a_design_build_whose_figures_add_up(
    completed_assessment,
) -> None:
    request = _request_with_build(completed_assessment, _design_build())

    request.validate_design_build()


def test_report_request_rejects_a_design_build_with_altered_totals(
    completed_assessment,
) -> None:
    request = _request_with_build(
        completed_assessment,
        _design_build(total_investment_php=999999.0),
    )

    with pytest.raises(ValueError, match="subtotal and VAT"):
        request.validate_design_build()


def test_report_request_rejects_a_design_build_with_altered_line_totals(
    completed_assessment,
) -> None:
    request = _request_with_build(
        completed_assessment,
        _design_build(subtotal_php=500000.0, vat_php=216576.0),
    )

    with pytest.raises(ValueError, match="component totals"):
        request.validate_design_build()
