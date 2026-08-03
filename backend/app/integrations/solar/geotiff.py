# Defines Google Solar GeoTIFF download helpers.

from urllib.parse import parse_qs, urlparse

import httpx

from app.integrations.solar.errors import SolarApiError

GEOTIFF_GET_URL = "https://solar.googleapis.com/v1/geoTiff:get"


def extract_geotiff_asset_id(source_url: str) -> str:
    parsed = urlparse(source_url)
    asset_ids = parse_qs(parsed.query).get("id")
    if not asset_ids or not asset_ids[0]:
        raise SolarApiError("Google Solar GeoTIFF URL is missing an asset id.")
    return asset_ids[0]


def fetch_geotiff_bytes(source_url: str, *, api_key: str) -> bytes:
    """Download a Solar API GeoTIFF using a fresh geoTiff:get request.

    The signed URLs returned by dataLayers must not be re-requested by appending
    query params to the full URL; httpx would re-encode the asset id and Google
    responds with 400 INVALID_ARGUMENT.
    """
    asset_id = extract_geotiff_asset_id(source_url)
    try:
        response = httpx.get(
            GEOTIFF_GET_URL,
            params={"id": asset_id, "key": api_key},
            timeout=60.0,
            follow_redirects=True,
        )
    except httpx.HTTPError as error:
        raise SolarApiError(f"Google Solar GeoTIFF request failed: {error}") from error

    if response.status_code >= 400:
        detail = _extract_error_detail(response)
        raise SolarApiError(
            f"Google Solar GeoTIFF request failed ({response.status_code}): {detail}"
        )

    return response.content


def _extract_error_detail(response: httpx.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        return response.text or "unknown error"

    error = payload.get("error", {})
    message = error.get("message")
    if message:
        return message
    return response.text or "unknown error"
