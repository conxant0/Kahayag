from decimal import Decimal

import pytest

from app.features.reports.schemas import GeoPoint, PanelPolygon, ReportPDFRequest


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

