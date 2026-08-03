from unittest.mock import Mock, patch

from app.integrations.solar.google_solar import DATA_LAYERS_URL, GoogleSolarProvider


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
