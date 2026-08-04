from unittest.mock import Mock, patch

from app.integrations.solar.google_solar import (
    BUILDING_INSIGHTS_URL,
    DATA_LAYERS_URL,
    GoogleSolarProvider,
)


def test_find_closest_building_insights_accepts_every_imagery_tier():
    # Without `requiredQuality` the search is restricted to HIGH imagery, which
    # in the Philippines exists only around Cebu and Davao — everywhere else
    # answered 404 and the roof step fell back to the plain square.
    response = Mock(status_code=200)
    response.json.return_value = {"name": "buildings/x"}

    with patch(
        "app.integrations.solar.google_solar.httpx.get", return_value=response
    ) as get:
        result = GoogleSolarProvider(api_key="test-key").find_closest_building_insights(
            latitude=14.62237,
            longitude=121.06478,
        )

    assert result == {"name": "buildings/x"}
    get.assert_called_once_with(
        BUILDING_INSIGHTS_URL,
        params={
            "location.latitude": 14.62237,
            "location.longitude": 121.06478,
            "requiredQuality": "BASE",
            "key": "test-key",
        },
        timeout=30.0,
    )


def test_get_data_layers_requests_base_quality_and_requested_location():
    response = Mock(status_code=200)
    response.json.return_value = {
        "annualFluxUrl": "annual",
        "maskUrl": "mask",
    }

    with patch(
        "app.integrations.solar.google_solar.httpx.get", return_value=response
    ) as get:
        result = GoogleSolarProvider(api_key="test-key").get_data_layers(
            latitude=10.3157,
            longitude=123.8854,
            radius_meters=140,
        )

    assert result == {"annualFluxUrl": "annual", "maskUrl": "mask"}
    get.assert_called_once_with(
        DATA_LAYERS_URL,
        params={
            "location.latitude": 10.3157,
            "location.longitude": 123.8854,
            "radiusMeters": 140,
            "view": "IMAGERY_AND_ANNUAL_FLUX_LAYERS",
            "requiredQuality": "BASE",
            "key": "test-key",
        },
        timeout=30.0,
    )
