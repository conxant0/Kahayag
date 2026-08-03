import pytest

from app.features.solar_flux.cache import get_flux_layers, store_flux_layers
from app.features.solar_flux.schemas import SolarFluxPrepareRequest
from app.features.solar_flux.service import prepare_flux_visualization


class TestSolarFluxCache:
    def test_stores_and_retrieves_flux_layers(self):
        token = store_flux_layers(
            annual_flux_url="https://example.com/annual",
            mask_url="https://example.com/mask",
        )

        cached = get_flux_layers(token)

        assert cached is not None
        assert cached.annual_flux_url == "https://example.com/annual"
        assert cached.mask_url == "https://example.com/mask"


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

        assert response.annual_flux_path.endswith("/annual")
        assert response.mask_path.endswith("/mask")
        assert response.imagery_quality == "HIGH"

        token = response.annual_flux_path.split("/")[-2]
        cached = get_flux_layers(token)
        assert cached is not None
