# Defines assessment use-case orchestration.

from collections.abc import Callable
from decimal import Decimal

from app.domain.solar import assumptions
from app.domain.solar.calculations import (
    DemandEstimate,
    calculate_annual_generation_kwh,
    calculate_annual_savings_php,
    calculate_base_cost_php,
    calculate_billable_generation_kwh,
    calculate_consumption_offset_ratio,
    calculate_cost_range_php,
    calculate_monthly_savings_php,
    calculate_payback_years,
    calculate_system_capacity_kwp,
    estimate_demand,
)
from app.domain.solar.geometry import max_panels_by_roof
from app.domain.solar.projection import project_investment
from app.domain.solar.recommendations import (
    build_adjustment_rationale,
    build_rationale,
    calculate_budget_gap_php,
    classify_adjustment_constraint,
    determine_panel_count,
    max_panels_by_budget,
    max_panels_by_demand,
    validate_layout_panel_count,
)
from app.domain.shading.analysis import ShadingAnalysis
from app.domain.solar.resource import SolarResource
from app.features.assessment.schemas import (
    AssessmentAssumptions,
    AssessmentInputs,
    AssessmentRequest,
    CompletedAssessment,
    FinancialValues,
    InvestmentProjectionAssumptions,
    InvestmentProjectionMilestone,
    InvestmentProjectionRequest,
    InvestmentProjectionResponse,
    PanelCountAdjustmentRequest,
    PanelCountAdjustmentResponse,
    Recommendation,
    RoofSegmentShadingSummary,
    ShadingSummary,
)
from app.features.assessment.solar_resource import resolve_solar_resource
from app.integrations.solar.provider import SolarDataProvider


def _build_assumptions(
    panel_category: assumptions.PanelCategory,
    solar_resource: SolarResource,
) -> AssessmentAssumptions:
    return AssessmentAssumptions(
        panel_width_m=panel_category.width_m,
        panel_height_m=panel_category.height_m,
        peak_sun_hours_per_day=solar_resource.peak_sun_hours_per_day,
        performance_ratio=assumptions.PERFORMANCE_RATIO,
        annual_sunshine_hours_per_kwp=solar_resource.annual_sunshine_hours_per_kwp,
        solar_resource_source=solar_resource.source,
        cost_low_php_per_kwp=assumptions.COST_LOW_PHP_PER_KWP,
        cost_high_php_per_kwp=assumptions.COST_HIGH_PHP_PER_KWP,
        cost_inclusions=assumptions.COST_INCLUSIONS,
        potential_exclusions=assumptions.POTENTIAL_EXCLUSIONS,
    )


def _build_shading_summary(analysis: ShadingAnalysis | None) -> ShadingSummary | None:
    if analysis is None:
        return None

    return ShadingSummary(
        shading_impact=analysis.shading_impact,
        sunshine_retention_ratio=analysis.sunshine_retention_ratio,
        whole_roof_median_sunshine_hours_per_year=(
            analysis.whole_roof_median_sunshine_hours_per_year
        ),
        max_sunshine_hours_per_year=analysis.max_sunshine_hours_per_year,
        data_source=analysis.data_source,
        applied_to_generation=True,
        roof_segments=tuple(
            RoofSegmentShadingSummary(
                segment_index=segment.segment_index,
                center_latitude=Decimal(str(segment.center_latitude)),
                center_longitude=Decimal(str(segment.center_longitude)),
                area_m2=segment.area_m2,
                pitch_degrees=segment.pitch_degrees,
                azimuth_degrees=segment.azimuth_degrees,
                median_sunshine_hours_per_year=segment.median_sunshine_hours_per_year,
                sunshine_retention_ratio=segment.sunshine_retention_ratio,
            )
            for segment in analysis.roof_segments
        ),
    )


def _build_limitations(*extra: str | None) -> tuple[str, ...]:
    limitations = list(assumptions.LIMITATIONS)
    for item in extra:
        if item:
            limitations.append(item)
    return tuple(limitations)


def _size_system(
    panel_count: int,
    panel_category: assumptions.PanelCategory,
    inputs: AssessmentInputs,
    demand: DemandEstimate,
    limiting_constraint: str,
    solar_resource: SolarResource,
    build_rationale_for: Callable[[Decimal, int | None], str],
) -> tuple[Recommendation, FinancialValues]:
    annual_consumption_kwh = demand.annual_consumption_kwh
    system_capacity_kwp = calculate_system_capacity_kwp(
        panel_count, panel_category.wattage_w
    )
    annual_generation_kwh = calculate_annual_generation_kwh(
        system_capacity_kwp,
        solar_resource=solar_resource,
    )
    offset_ratio = calculate_consumption_offset_ratio(
        annual_generation_kwh, annual_consumption_kwh
    )

    estimated_cost_low_php, estimated_cost_high_php = calculate_cost_range_php(
        system_capacity_kwp
    )
    billable_generation_kwh = calculate_billable_generation_kwh(
        annual_generation_kwh, annual_consumption_kwh
    )
    annual_savings_php = calculate_annual_savings_php(
        billable_generation_kwh, demand.resolved_tariff_php_per_kwh
    )
    estimated_base_cost_php = calculate_base_cost_php(system_capacity_kwp)
    monthly_savings_php = calculate_monthly_savings_php(annual_savings_php)
    payback_years = calculate_payback_years(
        estimated_base_cost_php, annual_savings_php
    )
    budget_gap_php = calculate_budget_gap_php(
        estimated_cost_low_php, inputs.budget_php
    )
    budget_compatible = budget_gap_php is None or budget_gap_php == 0
    rationale = build_rationale_for(system_capacity_kwp, budget_gap_php)

    recommendation = Recommendation(
        panel_category_id=panel_category.id,
        panel_wattage_w=panel_category.wattage_w,
        panel_count=panel_count,
        system_capacity_kwp=system_capacity_kwp,
        annual_generation_kwh=annual_generation_kwh,
        annual_consumption_offset_ratio=offset_ratio,
        limiting_constraint=limiting_constraint,
        rationale=rationale,
    )

    financials = FinancialValues(
        estimated_cost_low_php=estimated_cost_low_php,
        estimated_base_cost_php=estimated_base_cost_php,
        estimated_cost_high_php=estimated_cost_high_php,
        annual_savings_php=annual_savings_php,
        monthly_savings_php=monthly_savings_php,
        payback_years=payback_years,
        budget_compatible=budget_compatible,
        budget_gap_php=budget_gap_php,
    )

    return recommendation, financials


def build_assessment_response(
    request: AssessmentRequest,
    *,
    solar_provider: SolarDataProvider,
) -> CompletedAssessment:
    solar_resource, shading_analysis, solar_limitation = resolve_solar_resource(
        latitude=float(request.property.latitude),
        longitude=float(request.property.longitude),
        solar_provider=solar_provider,
    )

    budget_php = request.inputs.budget_php
    panel_category = assumptions.PANEL_CATEGORIES[request.inputs.panel_category_id]
    roof_limit = max_panels_by_roof(
        request.roof.usable_area_m2,
        panel_category.area_m2,
    )
    demand = estimate_demand(
        monthly_bill_php=request.inputs.monthly_bill_php,
        monthly_consumption_kwh=request.inputs.monthly_consumption_kwh,
        electricity_rate_php_per_kwh=request.inputs.electricity_rate_php_per_kwh,
        solar_resource=solar_resource,
    )
    demand_limit = max_panels_by_demand(
        demand.consumption_limited_system_size_kwp,
        panel_category.wattage_w,
    )
    budget_limit = max_panels_by_budget(budget_php, panel_category.wattage_w)
    panel_count, limiting_constraint = determine_panel_count(
        roof_limit,
        budget_limit,
        demand_limit,
        budget_php,
        panel_category,
    )

    recommendation, financials = _size_system(
        panel_count,
        panel_category,
        request.inputs,
        demand,
        limiting_constraint,
        solar_resource,
        lambda system_capacity_kwp, budget_gap_php: build_rationale(
            limiting_constraint,
            panel_count,
            system_capacity_kwp,
            roof_limit,
            budget_limit,
            demand_limit,
            panel_category,
            budget_php,
            budget_gap_php,
        ),
    )

    return CompletedAssessment(
        property=request.property,
        roof=request.roof,
        inputs=request.inputs,
        estimated_monthly_consumption_kwh=demand.estimated_monthly_consumption_kwh,
        consumption_source=demand.consumption_source,
        uses_default_tariff=demand.uses_default_tariff,
        resolved_tariff_php_per_kwh=demand.resolved_tariff_php_per_kwh,
        recommendation=recommendation,
        financials=financials,
        assumptions=_build_assumptions(panel_category, solar_resource),
        shading=_build_shading_summary(shading_analysis),
        limitations=_build_limitations(solar_limitation),
        is_provisional=True,
    )


def build_investment_projection(
    request: InvestmentProjectionRequest,
) -> InvestmentProjectionResponse:
    assessment = request.assessment
    projection = project_investment(
        year_one_generation_kwh=assessment.recommendation.annual_generation_kwh,
        baseline_monthly_consumption_kwh=(
            assessment.estimated_monthly_consumption_kwh
        ),
        baseline_rate_php_per_kwh=assessment.resolved_tariff_php_per_kwh,
        baseline_annual_savings_php=assessment.financials.annual_savings_php,
        monthly_consumption_kwh=request.monthly_consumption_kwh,
        rate_php_per_kwh=request.electricity_rate_php_per_kwh,
        system_cost_php=request.system_cost_php,
    )
    milestone_years = {6, 12, 18, 25}
    return InvestmentProjectionResponse(
        system_cost_php=request.system_cost_php,
        monthly_savings_php=projection.monthly_savings_php,
        annual_savings_php=projection.annual_savings_php,
        co2_tonnes_per_year=projection.co2_tonnes_per_year,
        break_even_year=projection.break_even_year,
        year_10_net_php=projection.year_10_net_php,
        year_25_net_php=projection.year_25_net_php,
        lifetime_gross_savings_php=projection.lifetime_gross_savings_php,
        milestones=tuple(
            InvestmentProjectionMilestone(
                year=row.year,
                cumulative_net_php=row.cumulative_net_php,
            )
            for row in projection.years
            if row.year in milestone_years
        ),
        assumptions=InvestmentProjectionAssumptions(
            analysis_years=assumptions.ANALYSIS_YEARS,
            electricity_escalation_ratio=assumptions.ELECTRICITY_ESCALATION_RATIO,
            annual_panel_degradation_ratio=assumptions.ANNUAL_PANEL_DEGRADATION_RATIO,
        ),
    )


def adjust_panel_count(
    request: PanelCountAdjustmentRequest,
    *,
    solar_provider: SolarDataProvider,
) -> PanelCountAdjustmentResponse:
    solar_resource, _, _ = resolve_solar_resource(
        latitude=float(request.property.latitude),
        longitude=float(request.property.longitude),
        solar_provider=solar_provider,
    )

    budget_php = request.inputs.budget_php
    panel_category = assumptions.PANEL_CATEGORIES[request.inputs.panel_category_id]
    roof_limit = max_panels_by_roof(
        request.roof.usable_area_m2,
        panel_category.area_m2,
    )
    demand = estimate_demand(
        monthly_bill_php=request.inputs.monthly_bill_php,
        monthly_consumption_kwh=request.inputs.monthly_consumption_kwh,
        electricity_rate_php_per_kwh=request.inputs.electricity_rate_php_per_kwh,
        solar_resource=solar_resource,
    )
    demand_limit = max_panels_by_demand(
        demand.consumption_limited_system_size_kwp,
        panel_category.wattage_w,
    )
    budget_limit = max_panels_by_budget(budget_php, panel_category.wattage_w)
    requested_panel_count = request.requested_panel_count

    validate_layout_panel_count(
        requested_panel_count,
        roof_limit,
        budget_limit,
        budget_php,
        panel_category,
    )

    recommendation, financials = _size_system(
        requested_panel_count,
        panel_category,
        request.inputs,
        demand,
        classify_adjustment_constraint(
            requested_panel_count, roof_limit, budget_limit, demand_limit
        ),
        solar_resource,
        lambda system_capacity_kwp, budget_gap_php: build_adjustment_rationale(
            requested_panel_count,
            system_capacity_kwp,
            roof_limit,
            budget_limit,
            demand_limit,
            panel_category,
            budget_php,
            budget_gap_php,
        ),
    )

    return PanelCountAdjustmentResponse(
        recommendation=recommendation, financials=financials
    )
