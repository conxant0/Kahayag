// Fixture mirroring the source worktree's e2e/helpers/mockAssessmentApi.js
// MOCK_ASSESSMENT_RESPONSE. Kept as a unit-test fixture here (not under
// frontend/e2e/) because this task does not build or modify e2e specs.
import type { AssessmentResult } from "../../../../src/shared/api/types";

export const MOCK_ASSESSMENT_RESPONSE: AssessmentResult = {
  property: {
    address: "Demo property, Cebu City, Philippines",
    latitude: "10.3157",
    longitude: "123.8854",
    assessment_date: "2026-07-28",
  },
  roof: {
    area_m2: "120.00",
    usable_area_m2: "120.00",
  },
  inputs: {
    monthly_bill_php: 4800,
    monthly_consumption_kwh: "400.00",
    electricity_rate_php_per_kwh: "12.00",
    budget_php: 300000,
    panel_category_id: "standard-450",
  },
  recommendation: {
    panel_category_id: "standard-450",
    panel_wattage_w: 450,
    panel_count: 9,
    system_capacity_kwp: "4.05",
    annual_generation_kwh: "5913",
    annual_consumption_offset_ratio: "0.99",
    limiting_constraint: "demand",
    rationale:
      "Sized to 9 panels (4.05 kWp) to match estimated electricity consumption.",
  },
  financials: {
    estimated_cost_low_php: 202500,
    estimated_base_cost_php: 243000,
    estimated_cost_high_php: 283500,
    annual_savings_php: 57600,
    monthly_savings_php: 4800,
    payback_years: "4.2",
    budget_compatible: true,
    budget_gap_php: 0,
  },
  assumptions: {
    panel_width_m: "1.13",
    panel_height_m: "1.76",
    peak_sun_hours_per_day: "5.00",
    performance_ratio: "0.80",
    annual_sunshine_hours_per_kwp: "1612.3",
    solar_resource_source: "google_solar_api",
    cost_low_php_per_kwp: 50000,
    cost_high_php_per_kwp: 70000,
    cost_inclusions: ["Solar panels", "Inverter", "Standard installation"],
    potential_exclusions: ["Roof repairs", "Electrical upgrades", "Permits"],
  },
  shading: {
    shading_impact: "low",
    sunshine_retention_ratio: "0.96",
    whole_roof_median_sunshine_hours_per_year: "1612.3",
    max_sunshine_hours_per_year: "1677.2",
    data_source: "google_solar_api",
    applied_to_generation: true,
    flux_visualization: {
      annual_flux_path: "/solar/flux/geotiff/demo-token/annual",
      mask_path: "/solar/flux/geotiff/demo-token/mask",
      imagery_quality: "HIGH",
    },
    roof_segments: [
      {
        segment_index: 0,
        center_latitude: "10.3159",
        center_longitude: "123.8852",
        area_m2: "40.8",
        pitch_degrees: "14.0",
        azimuth_degrees: "168.0",
        median_sunshine_hours_per_year: "1585.0",
        sunshine_retention_ratio: "0.94",
      },
      {
        segment_index: 1,
        center_latitude: "10.3158",
        center_longitude: "123.8854",
        area_m2: "36.1",
        pitch_degrees: "16.0",
        azimuth_degrees: "175.0",
        median_sunshine_hours_per_year: "1662.1",
        sunshine_retention_ratio: "0.99",
      },
      {
        segment_index: 5,
        center_latitude: "10.3158",
        center_longitude: "123.8855",
        area_m2: "21.7",
        pitch_degrees: "12.0",
        azimuth_degrees: "170.0",
        median_sunshine_hours_per_year: "1210.9",
        sunshine_retention_ratio: "0.72",
      },
    ],
  },
  limitations: [
    "This result is a preliminary pre-feasibility estimate.",
    "A licensed solar professional must verify the final design and quotation.",
  ],
  is_provisional: true,
};
