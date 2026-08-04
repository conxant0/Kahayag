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

export type SolverGoal = "auto" | "budget" | "backup" | "independence";
export type BuildSource = "ai_suggested" | "custom" | "user" | "uploaded";
export type ComponentSlot =
  | "panel"
  | "inverter"
  | "battery"
  | "protection"
  | "structure"
  | "electrical"
  | "installation";

export interface DesignComponent {
  slot: ComponentSlot;
  catalog_id: string | null;
  brand: string;
  model: string;
  summary: string;
  qty: number;
  unit: string;
  unit_price_php: number;
  price_as_of: string | null;
  line_total_php: number;
  warranty_note: string;
  badges: string[];
  specs: Record<string, string | number>;
  product_image?: string | null;
}

export interface RejectionReason {
  combo_key: string;
  code: string;
  message: string;
  details: Record<string, string | number>;
}

export interface SolverConstraintsSummary {
  target_kwp: number;
  max_panel_count: number;
  usable_roof_area_m2: number;
  budget_php: number | null;
  require_battery: boolean;
  min_battery_kwh: number | null;
  goal: SolverGoal;
}

export interface ValidComboSummary {
  combo_id: string;
  panel_id: string;
  inverter_id: string;
  battery_id: string | null;
  panel_count: number;
  system_kwp: number;
  dc_ac_ratio: number;
  inverter_utilisation_pct: number;
  fit_score: number;
  rejection_log_ref: string;
  estimated_cost_php: number;
}

export interface SolveResultSummary {
  solve_id: string;
  constraints: SolverConstraintsSummary;
  valid: ValidComboSummary[];
  rejections: RejectionReason[];
}

export interface DesignBuild {
  id: string;
  label: string;
  tags: string[];
  combo_id: string;
  solve_id: string;
  system_kwp: number;
  panel_count: number;
  inverter_kw: number;
  battery_kwh: number | null;
  monthly_savings_php: number;
  annual_savings_php: number;
  payback_years: number | null;
  total_investment_php: number;
  total_investment_low_php: number;
  total_investment_high_php: number;
  subtotal_php: number;
  vat_php: number;
  inverter_utilisation_pct: number;
  fit_score: number;
  co2_tonnes_avoided_yearly: number;
  insight: string;
  components: DesignComponent[];
  source: BuildSource;
}

export interface AgentAuditEntry {
  turn_id: string;
  user_text: string;
  tool_calls: Array<Record<string, unknown>>;
  solve_ids: string[];
  final_build_id: string | null;
}

export interface DesignSession {
  property_ref: string;
  assessment_fingerprint: string;
  active_build_id: string;
  builds: DesignBuild[];
  last_solve: SolveResultSummary | null;
  applied: boolean;
  agent_audit: AgentAuditEntry[];
}

export interface QuotationLine {
  item: string;
  description: string;
  brand: string;
  uom: string;
  qty: number;
  unit_price_php: number;
  amount_php: number;
  price_as_of: string | null;
}

export interface QuotationDocument {
  build_id: string;
  quote_number: string;
  quote_date: string;
  validity_days: number;
  lines: QuotationLine[];
  subtotal_php: number;
  vat_php: number;
  total_php: number;
  total_low_php: number;
  total_high_php: number;
  payment_terms: string;
  warranty_summary: string;
  is_draft: boolean;
}

export type QuoteAuditSeverity = "info" | "warning" | "positive";

export interface QuoteAuditFinding {
  category: string;
  severity: QuoteAuditSeverity;
  message: string;
}

export interface QuoteAuditResponse {
  filename: string;
  extracted_total_php: number | null;
  extracted_system_kwp: number | null;
  extracted_panel_count: number | null;
  benchmark_total_php: number;
  benchmark_system_kwp: number;
  findings: QuoteAuditFinding[];
  summary: string;
  diagram_components: DesignComponent[];
}

export interface MutateDesignPayload {
  session: DesignSession;
  goal?: SolverGoal;
  budget_php?: number;
  require_battery?: boolean;
  min_battery_kwh?: number;
  locked_panel_id?: string;
  locked_inverter_id?: string;
  locked_battery_id?: string;
  panel_count_delta?: number;
}

export type CatalogPickerSlot = "panel" | "inverter" | "battery";
export type CatalogOptionStatus = "selected" | "recommended" | "compatible" | "incompatible";

export interface CatalogOption {
  id: string;
  brand: string;
  model: string;
  summary: string;
  status: CatalogOptionStatus;
  reason: string | null;
  specs: Record<string, string | number>;
}
