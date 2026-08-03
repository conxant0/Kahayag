# Defines API schemas reused across backend features.

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class ContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class GeoCoordinate(ContractModel):
    """Provider-neutral WGS84 location, in decimal degrees."""

    latitude: Decimal = Field(ge=-90, le=90)
    longitude: Decimal = Field(ge=-180, le=180)


class MapViewport(ContractModel):
    """Provider-neutral map camera position: center plus zoom level."""

    center: GeoCoordinate
    zoom_level: Decimal = Field(ge=0, le=22)


class RoofPolygon(ContractModel):
    """Roof boundary as an ordered ring of coordinates. MVP supports one polygon."""

    vertices: tuple[GeoCoordinate, ...] = Field(min_length=3)


class RoofArea(ContractModel):
    """Calculated roof area, in square meters."""

    area_m2: Decimal = Field(gt=0)


class PropertyLocation(ContractModel):
    """Provider-neutral property identity: a human address plus its coordinate."""

    address: str = Field(min_length=1)
    coordinate: GeoCoordinate
