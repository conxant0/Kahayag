# Defines solar flux visualization API schemas.

from pydantic import BaseModel, Field


class SolarFluxPrepareRequest(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    radius_meters: int = Field(default=100, ge=25, le=175)


class FluxVisualizationOut(BaseModel):
    annual_flux_path: str = Field(min_length=1)
    mask_path: str = Field(min_length=1)
    imagery_quality: str | None = None
