# Defines report request and response API schemas.

from decimal import Decimal

from pydantic import Field

from app.features.assessment.schemas import CompletedAssessment, ContractModel
from app.features.design.schemas import DesignBuildSchema


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
    # The design the homeowner settled on in the D3 flow, when they went
    # through it. There is no server session to look it up from, so it rides
    # along like the assessment does; the quotation itself is recomposed
    # server-side from this build, never accepted from the client.
    design_build: DesignBuildSchema | None = None

    def validate_panel_count(self) -> None:
        if len(self.panel_polygons) != self.assessment.recommendation.panel_count:
            raise ValueError(
                "panel polygon count must match the completed assessment"
            )

    def validate_design_build(self) -> None:
        """Rejects a build whose figures no longer add up — the sums the
        solver produced always do, so a mismatch means the values were
        altered after it computed them."""
        build = self.design_build
        if build is None:
            return
        lines_total = sum(
            component.line_total_php for component in build.components
        )
        if abs(lines_total - build.subtotal_php) > 1:
            raise ValueError(
                "design build component totals must sum to its subtotal"
            )
        if abs(build.subtotal_php + build.vat_php - build.total_investment_php) > 1:
            raise ValueError(
                "design build subtotal and VAT must sum to its total investment"
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
