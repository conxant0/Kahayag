# Defines shading-analysis API schemas.

from decimal import Decimal

from pydantic import Field

from app.domain.shading.analysis import ShadingImpact
from app.shared.schemas import ContractModel


class ShadingAnalysisRequest(ContractModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class RoofSegmentShadingOut(ContractModel):
    segment_index: int = Field(ge=0)
    center_latitude: Decimal = Field(ge=-90, le=90)
    center_longitude: Decimal = Field(ge=-180, le=180)
    area_m2: Decimal = Field(ge=0)
    pitch_degrees: Decimal = Field(ge=0, le=90)
    azimuth_degrees: Decimal = Field(ge=0, lt=360)
    median_sunshine_hours_per_year: Decimal = Field(ge=0)
    max_sunshine_hours_per_year: Decimal = Field(ge=0)
    sunshine_retention_ratio: Decimal = Field(ge=0, le=1)


class ShadingAnalysisResponse(ContractModel):
    query_latitude: float = Field(ge=-90, le=90)
    query_longitude: float = Field(ge=-180, le=180)
    building_center_latitude: float = Field(ge=-90, le=90)
    building_center_longitude: float = Field(ge=-180, le=180)
    imagery_quality: str
    max_sunshine_hours_per_year: Decimal = Field(ge=0)
    whole_roof_median_sunshine_hours_per_year: Decimal = Field(ge=0)
    whole_roof_min_sunshine_hours_per_year: Decimal = Field(ge=0)
    sunshine_retention_ratio: Decimal = Field(ge=0, le=1)
    shading_impact: ShadingImpact
    estimated_generation_derate_ratio: Decimal = Field(ge=0, le=1)
    roof_area_m2: Decimal = Field(ge=0)
    roof_segment_count: int = Field(ge=0)
    roof_segments: tuple[RoofSegmentShadingOut, ...]
    data_source: str
    imagery_date: str | None
    limitations: tuple[str, ...]
    is_provisional: bool = True
