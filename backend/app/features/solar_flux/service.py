# Defines solar flux visualization orchestration.

from app.features.solar_flux.cache import store_flux_layers
from app.features.solar_flux.schemas import (
    FluxVisualizationOut,
    SolarFluxPrepareRequest,
)
from app.integrations.solar.errors import SolarApiError, SolarProviderDisabledError
from app.integrations.solar.provider import SolarDataProvider


def prepare_flux_visualization(
    request: SolarFluxPrepareRequest,
    *,
    solar_provider: SolarDataProvider,
) -> FluxVisualizationOut:
    layers = solar_provider.get_data_layers(
        latitude=request.latitude,
        longitude=request.longitude,
        radius_meters=request.radius_meters,
    )
    token = store_flux_layers(
        annual_flux_url=layers["annualFluxUrl"],
        mask_url=layers["maskUrl"],
    )
    return FluxVisualizationOut(
        annual_flux_path=f"/solar/flux/geotiff/{token}/annual",
        mask_path=f"/solar/flux/geotiff/{token}/mask",
        imagery_quality=layers.get("imageryQuality"),
    )


def try_prepare_flux_visualization(
    *,
    latitude: float,
    longitude: float,
    solar_provider: SolarDataProvider,
    radius_meters: int = 100,
) -> FluxVisualizationOut | None:
    try:
        return prepare_flux_visualization(
            SolarFluxPrepareRequest(
                latitude=latitude,
                longitude=longitude,
                radius_meters=radius_meters,
            ),
            solar_provider=solar_provider,
        )
    except (SolarProviderDisabledError, SolarApiError, AttributeError):
        return None
