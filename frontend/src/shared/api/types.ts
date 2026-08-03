// Defines TypeScript shapes for the completed-assessment API contract shared
// across the reports, recommendation, and assessment features.
export interface GeoPoint {
  latitude: number;
  longitude: number;
}

// Session-only roof trace state (not an API response shape).
export interface RoofPolygon {
  coordinates: GeoPoint[];
}

export type ShadingImpact = "low" | "moderate" | "high" | "severe";

export interface RoofSegmentShadingSummary {
  segment_index: number;
  center_latitude: string;
  center_longitude: string;
  area_m2: string;
  pitch_degrees: string;
  azimuth_degrees: string;
  median_sunshine_hours_per_year: string;
  sunshine_retention_ratio: string;
}

export interface FluxVisualizationSummary {
  annual_flux_path: string;
  mask_path: string;
  imagery_quality?: string | null;
}

export interface ShadingSummary {
  shading_impact: ShadingImpact;
  sunshine_retention_ratio: string;
  whole_roof_median_sunshine_hours_per_year: string;
  max_sunshine_hours_per_year: string;
  data_source: string;
  applied_to_generation: boolean;
  roof_segments: RoofSegmentShadingSummary[];
  flux_visualization?: FluxVisualizationSummary | null;
}

export interface AssessmentResult {
  property: {
    address: string;
    latitude: string;
    longitude: string;
    assessment_date: string;
  };
  roof: {
    area_m2: string;
    usable_area_m2: string;
  };
  inputs: {
    monthly_bill_php: number;
    monthly_consumption_kwh: string | null;
    electricity_rate_php_per_kwh: string | null;
    budget_php: number | null;
    panel_category_id: string;
  };
  estimated_monthly_consumption_kwh: string;
  consumption_source: "direct" | "bill";
  uses_default_tariff: boolean;
  resolved_tariff_php_per_kwh: string;
  recommendation: {
    panel_category_id: string;
    panel_wattage_w: number;
    panel_count: number;
    system_capacity_kwp: string;
    annual_generation_kwh: string;
    annual_consumption_offset_ratio: string;
    limiting_constraint: string;
    rationale: string;
  };
  financials: {
    estimated_cost_low_php: number;
    estimated_base_cost_php: number;
    estimated_cost_high_php: number;
    annual_savings_php: number;
    monthly_savings_php: number;
    payback_years: string | null;
    budget_compatible: boolean;
    budget_gap_php: number | null;
  };
  assumptions: {
    panel_width_m: string;
    panel_height_m: string;
    peak_sun_hours_per_day: string;
    performance_ratio: string;
    annual_sunshine_hours_per_kwp: string;
    solar_resource_source: string;
    cost_low_php_per_kwp: number;
    cost_high_php_per_kwp: number;
    cost_inclusions: string[];
    potential_exclusions: string[];
  };
  shading?: ShadingSummary | null;
  limitations: string[];
  is_provisional: boolean;
}

export interface InvestmentProjectionRequest {
  assessment: AssessmentResult;
  monthly_consumption_kwh: number;
  electricity_rate_php_per_kwh: number;
  system_cost_php: number;
}

export interface InvestmentProjectionResponse {
  system_cost_php: number;
  monthly_savings_php: number;
  annual_savings_php: number;
  co2_tonnes_per_year: string;
  break_even_year: string | null;
  year_10_net_php: number;
  year_25_net_php: number;
  lifetime_gross_savings_php: number;
  milestones: Array<{ year: number; cumulative_net_php: number }>;
  assumptions: {
    analysis_years: number;
    electricity_escalation_ratio: string;
    annual_panel_degradation_ratio: string;
  };
}
