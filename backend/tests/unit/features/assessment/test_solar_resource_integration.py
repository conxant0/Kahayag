# Defines solar-resource fallback and provider tests.

from decimal import Decimal

from app.features.assessment.schemas import AssessmentRequest
from app.features.assessment.solar_resource import resolve_solar_resource
from app.features.assessment.service import build_assessment_response
from app.integrations.solar.disabled import DisabledSolarProvider
from app.integrations.solar.errors import SolarApiError


def test_disabled_provider_returns_nationwide_fallback():
    resource, shading, limitation = resolve_solar_resource(
        latitude=10.3157,
        longitude=123.8854,
        solar_provider=DisabledSolarProvider(),
    )

    assert resource.source == "nationwide_fallback"
    assert shading is None
    assert limitation is not None
    assert "nationwide planning fallback" in limitation


def test_transport_failure_returns_nationwide_fallback():
    class FailingProvider:
        def find_closest_building_insights(self, *, latitude, longitude):
            raise SolarApiError("timed out")

    resource, shading, limitation = resolve_solar_resource(
        latitude=10.3157,
        longitude=123.8854,
        solar_provider=FailingProvider(),
    )

    assert resource.source == "nationwide_fallback"
    assert shading is None
    assert limitation is not None


def test_building_insights_provider_supplies_location_specific_resource(
    cebu_building_insights_payload,
):
    class CebuProvider:
        def find_closest_building_insights(self, *, latitude, longitude):
            return cebu_building_insights_payload

    request = AssessmentRequest.model_validate(
        {
            "property": {
                "address": "Demo property, Cebu City, Philippines",
                "latitude": "10.3157",
                "longitude": "123.8854",
                "assessment_date": "2026-07-25",
            },
            "roof": {"area_m2": "40.00", "usable_area_m2": "32.00"},
            "inputs": {
                "monthly_bill_php": 6000,
                "monthly_consumption_kwh": "500.00",
                "electricity_rate_php_per_kwh": "12.00",
                "budget_php": 300000,
            },
        }
    )

    response = build_assessment_response(request, solar_provider=CebuProvider())

    assert response.assumptions.solar_resource_source == "google_solar_api"
    assert response.assumptions.annual_sunshine_hours_per_kwp == Decimal("1612.3")
    assert response.shading is not None
    assert response.shading.shading_impact == "low"
    assert response.recommendation.panel_count == 10
