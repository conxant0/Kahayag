import pytest

from app.integrations.solar.errors import SolarApiError
from app.integrations.solar.geotiff import extract_geotiff_asset_id


def test_extract_geotiff_asset_id_from_data_layers_url():
    url = (
        "https://solar.googleapis.com/v1/geoTiff:get?"
        "id=YTJkNTk3MDc5NDU1ZGFiYjI4MjQ5MDllO"
    )

    assert extract_geotiff_asset_id(url) == "YTJkNTk3MDc5NDU1ZGFiYjI4MjQ5MDllO"


def test_extract_geotiff_asset_id_rejects_missing_id():
    with pytest.raises(SolarApiError, match="missing an asset id"):
        extract_geotiff_asset_id("https://solar.googleapis.com/v1/geoTiff:get")
