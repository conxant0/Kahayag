// Defines backend API endpoint references.
export const ENDPOINTS = {
  health: "/health",
  assessments: "/assessments",
  panelCountAdjustment: "/assessments/panel-count-adjustment",
  propertySearch: "/properties/search",
  reportsPdf: "/reports/pdf",
} as const;
