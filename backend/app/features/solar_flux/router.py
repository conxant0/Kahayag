# Defines solar flux GeoTIFF proxy endpoints.

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from app.core.config import Settings, get_settings
from app.features.solar_flux.schemas import (
    FluxVisualizationOut,
    SolarFluxPrepareRequest,
)
from app.features.solar_flux.service import prepare_flux_visualization
from app.features.solar_flux.url_codec import decode_flux_url
from app.integrations.solar import get_solar_provider
from app.integrations.solar.errors import SolarApiError, SolarProviderDisabledError
from app.integrations.solar.geotiff import fetch_geotiff_bytes
from app.integrations.solar.provider import SolarDataProvider

router = APIRouter()

DependsSettings = Depends(get_settings)


def _get_solar_provider(
    settings: Settings = DependsSettings,
) -> SolarDataProvider:
    return get_solar_provider(settings)


DependsSolarProvider = Depends(_get_solar_provider)


@router.post("/solar/flux/prepare", response_model=FluxVisualizationOut)
def prepare_solar_flux(
    request: SolarFluxPrepareRequest,
    solar_provider: SolarDataProvider = DependsSolarProvider,
) -> FluxVisualizationOut:
    try:
        return prepare_flux_visualization(request, solar_provider=solar_provider)
    except SolarProviderDisabledError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except SolarApiError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


@router.get("/solar/flux/geotiff/{layer}/{token}")
def proxy_solar_flux_geotiff(
    layer: str,
    token: str,
    settings: Settings = DependsSettings,
) -> Response:
    if layer not in ("annual", "mask"):
        raise HTTPException(status_code=404, detail="Unknown flux layer.")

    try:
        source_url = decode_flux_url(token)
    except ValueError as error:
        raise HTTPException(status_code=404, detail="Invalid flux layer token.") from error

    if not settings.google_solar_api_key:
        raise HTTPException(status_code=503, detail="Google Solar API key is not configured.")

    try:
        content = fetch_geotiff_bytes(
            source_url,
            api_key=settings.google_solar_api_key,
        )
    except SolarApiError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    return Response(content=content, media_type="image/tiff")
