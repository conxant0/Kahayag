# Defines report request and response API schemas.

from decimal import Decimal

from pydantic import Field

from app.features.assessment.schemas import CompletedAssessment, ContractModel


class ValidatedReportInput(CompletedAssessment):
    """Assessment values approved for explanation and rendering."""


class GeoPoint(ContractModel):
    latitude: Decimal = Field(ge=-90, le=90)
    longitude: Decimal = Field(ge=-180, le=180)


class PanelPolygon(ContractModel):
    corners: tuple[GeoPoint, GeoPoint, GeoPoint, GeoPoint]


class ReportPDFRequest(ContractModel):
    assessment: CompletedAssessment
    roof_polygon: tuple[GeoPoint, ...] = Field(min_length=3)
    panel_polygons: tuple[PanelPolygon, ...] = Field(min_length=1)

    def validate_panel_count(self) -> None:
        if len(self.panel_polygons) != self.assessment.recommendation.panel_count:
            raise ValueError(
                "panel polygon count must match the completed assessment"
            )


class ProjectionRow(ContractModel):
    year: int = Field(ge=1, le=25)
    generation_kwh: Decimal = Field(ge=0)
    annual_savings_php: int = Field(ge=0)
    cumulative_net_php: int


class SensitivityCase(ContractModel):
    label: str
    generation_ratio: Decimal = Field(gt=0)
    installed_cost_ratio: Decimal = Field(gt=0)
    payback_years: Decimal | None = Field(default=None, ge=0)
    year_25_net_php: int


class ReportNarrative(ContractModel):
    executive_summary: str = Field(min_length=1, max_length=1200)
    technical_explanation: str = Field(min_length=1, max_length=1200)
    financial_explanation: str = Field(min_length=1, max_length=1200)
    contractor_observations: tuple[str, ...] = Field(min_length=3, max_length=5)


class ResolvedReportNarrative(ReportNarrative):
    used_fallback: bool


class ReportExplanation(ContractModel):
    summary: str = Field(min_length=1)
    recommendation_reason: str = Field(min_length=1)
    next_steps: tuple[str, ...] = Field(min_length=1)


class ResolvedReportExplanation(ReportExplanation):
    used_fallback: bool
