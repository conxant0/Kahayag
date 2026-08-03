import pytest

from app.features.solar_flux.schemas import SolarFluxPrepareRequest
from app.features.solar_flux.service import prepare_flux_visualization
from app.features.solar_flux.url_codec import decode_flux_url, encode_flux_url


class TestFluxUrlCodec:
    def test_round_trips_a_url(self):
        token = encode_flux_url("https://example.com/annual?id=abc")

        assert decode_flux_url(token) == "https://example.com/annual?id=abc"


class TestPrepareFluxVisualization:
    def test_returns_proxied_paths(self):
        class FakeProvider:
            def get_data_layers(self, *, latitude, longitude, radius_meters=100):
                assert latitude == pytest.approx(10.3157)
                assert longitude == pytest.approx(123.8854)
                return {
                    "annualFluxUrl": "https://example.com/annual",
                    "maskUrl": "https://example.com/mask",
                    "imageryQuality": "HIGH",
                }

        response = prepare_flux_visualization(
            SolarFluxPrepareRequest(latitude=10.3157, longitude=123.8854),
            solar_provider=FakeProvider(),
        )

        assert response.annual_flux_path.startswith("/solar/flux/geotiff/annual/")
        assert response.mask_path.startswith("/solar/flux/geotiff/mask/")
        assert response.imagery_quality == "HIGH"

        annual_token = response.annual_flux_path.rsplit("/", 1)[-1]
        assert decode_flux_url(annual_token) == "https://example.com/annual"
