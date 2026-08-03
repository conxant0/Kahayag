from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_report_endpoint_returns_a_pdf_with_fallbacks(completed_assessment_data) -> None:
    roof = [
        {"latitude": "10.31570", "longitude": "123.88540"},
        {"latitude": "10.31582", "longitude": "123.88540"},
        {"latitude": "10.31582", "longitude": "123.88555"},
        {"latitude": "10.31570", "longitude": "123.88555"},
    ]
    panel = {"corners": roof}
    response = client.post(
        "/api/v1/reports/pdf",
        json={
            "assessment": completed_assessment_data,
            "roof_polygon": roof,
            "panel_polygons": [panel] * 8,
        },
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert "attachment;" in response.headers["content-disposition"]
    assert response.content.startswith(b"%PDF")


def test_report_endpoint_rejects_mismatched_panel_count(completed_assessment_data) -> None:
    roof = [
        {"latitude": "10.31570", "longitude": "123.88540"},
        {"latitude": "10.31582", "longitude": "123.88540"},
        {"latitude": "10.31582", "longitude": "123.88555"},
        {"latitude": "10.31570", "longitude": "123.88555"},
    ]
    response = client.post(
        "/api/v1/reports/pdf",
        json={
            "assessment": completed_assessment_data,
            "roof_polygon": roof,
            "panel_polygons": [{"corners": roof}] * 7,
        },
    )

    assert response.status_code == 422
    assert "panel polygon count" in response.json()["detail"]
