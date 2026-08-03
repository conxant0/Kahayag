# Defines assessment request and response API schemas.

from datetime import date
from decimal import Decimal

from typing import Literal

from pydantic import (
    Field,
    StrictBool,
    StrictInt,
    model_validator,
)

from app.domain.solar.assumptions import (
    DEFAULT_PANEL_CATEGORY_ID,
    PanelCategoryId,
)
from app.shared.schemas import ContractModel

ShadingImpact = Literal["low", "moderate", "high", "severe"]


class PropertyDetails(ContractModel):
    address: str = Field(min_length=1)
    latitude: Decimal = Field(ge=-90, le=90)
    longitude: Decimal = Field(ge=-180, le=180)
    assessment_date: date


class RoofDetails(ContractModel):
    area_m2: Decimal = Field(gt=0)
    usable_area_m2: Decimal = Field(gt=0)

    @model_validator(mode="after")
    def usable_area_cannot_exceed_area(self) -> "RoofDetails":
        if self.usable_area_m2 > self.area_m2:
            raise ValueError("usable_area_m2 cannot exceed area_m2")
        return self


class AssessmentInputs(ContractModel):
    monthly_bill_php: StrictInt = Field(gt=0)
    # Consumption is derived from the bill against a default tariff
    # (see estimate_demand) when not supplied directly.
    monthly_consumption_kwh: Decimal | None = Field(default=None, gt=0)
    electricity_rate_php_per_kwh: Decimal | None = Field(default=None, gt=0)
    budget_php: StrictInt | None = Field(default=None, gt=0)
    panel_category_id: PanelCategoryId = DEFAULT_PANEL_CATEGORY_ID


class Recommendation(ContractModel):
    panel_category_id: str = Field(min_length=1)
    panel_wattage_w: StrictInt = Field(gt=0)
    panel_count: StrictInt = Field(gt=0)
    system_capacity_kwp: Decimal = Field(gt=0)
    annual_generation_kwh: Decimal = Field(gt=0)
    annual_consumption_offset_ratio: Decimal = Field(ge=0, le=1)
    limiting_constraint: str = Field(min_length=1)
    rationale: str = Field(min_length=1)


class FinancialValues(ContractModel):
    estimated_cost_low_php: StrictInt = Field(ge=0)
    estimated_base_cost_php: StrictInt = Field(ge=0)
    estimated_cost_high_php: StrictInt = Field(ge=0)
    annual_savings_php: StrictInt = Field(ge=0)
    monthly_savings_php: StrictInt = Field(ge=0)
    payback_years: Decimal | None = Field(default=None, ge=0)
    budget_compatible: StrictBool
    budget_gap_php: StrictInt | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def cost_range_is_ordered(self) -> "FinancialValues":
        if self.estimated_cost_high_php < self.estimated_cost_low_php:
            raise ValueError("estimated cost high cannot be below low")
        return self


class AssessmentAssumptions(ContractModel):
    panel_width_m: Decimal = Field(gt=0)
    panel_height_m: Decimal = Field(gt=0)
    peak_sun_hours_per_day: Decimal = Field(gt=0)
    performance_ratio: Decimal = Field(gt=0, le=1)
    annual_sunshine_hours_per_kwp: Decimal = Field(gt=0)
    solar_resource_source: str = Field(min_length=1)
    cost_low_php_per_kwp: StrictInt = Field(ge=0)
    cost_high_php_per_kwp: StrictInt = Field(ge=0)
    cost_inclusions: tuple[str, ...] = Field(min_length=1)
    potential_exclusions: tuple[str, ...] = Field(min_length=1)

    @model_validator(mode="after")
    def cost_range_is_ordered(self) -> "AssessmentAssumptions":
        if self.cost_high_php_per_kwp < self.cost_low_php_per_kwp:
            raise ValueError("assumption cost high cannot be below low")
        return self


class RoofSegmentShadingSummary(ContractModel):
    segment_index: StrictInt = Field(ge=0)
    center_latitude: Decimal = Field(ge=-90, le=90)
    center_longitude: Decimal = Field(ge=-180, le=180)
    area_m2: Decimal = Field(gt=0)
    pitch_degrees: Decimal = Field(ge=0, le=90)
    azimuth_degrees: Decimal = Field(ge=0, lt=360)
    median_sunshine_hours_per_year: Decimal = Field(gt=0)
    sunshine_retention_ratio: Decimal = Field(ge=0, le=1)


class FluxVisualizationSummary(ContractModel):
    annual_flux_path: str = Field(min_length=1)
    mask_path: str = Field(min_length=1)
    imagery_quality: str | None = None


class ShadingSummary(ContractModel):
    shading_impact: ShadingImpact
    sunshine_retention_ratio: Decimal = Field(ge=0, le=1)
    whole_roof_median_sunshine_hours_per_year: Decimal = Field(gt=0)
    max_sunshine_hours_per_year: Decimal = Field(gt=0)
    data_source: str = Field(min_length=1)
    applied_to_generation: StrictBool = True
    roof_segments: tuple[RoofSegmentShadingSummary, ...] = ()
    flux_visualization: FluxVisualizationSummary | None = None


class AssessmentRequest(ContractModel):
    """Normalized property, roof, bill, and budget data submitted for assessment."""

    property: PropertyDetails
    roof: RoofDetails
    inputs: AssessmentInputs


class PanelCountAdjustmentRequest(ContractModel):
    """Roof, bill, budget, and property context plus a requested manual panel count."""

    property: PropertyDetails
    roof: RoofDetails
    inputs: AssessmentInputs
    requested_panel_count: StrictInt = Field(gt=0)


class PanelCountAdjustmentResponse(ContractModel):
    """Recommendation and financials recomputed for a validated panel count."""

    recommendation: Recommendation
    financials: FinancialValues


class CompletedAssessment(ContractModel):
    """Submitted assessment context plus the computed recommendation."""

    property: PropertyDetails
    roof: RoofDetails
    inputs: AssessmentInputs
    recommendation: Recommendation
    financials: FinancialValues
    assumptions: AssessmentAssumptions
    shading: ShadingSummary | None = None
    limitations: tuple[str, ...] = Field(min_length=1)
    is_provisional: StrictBool
