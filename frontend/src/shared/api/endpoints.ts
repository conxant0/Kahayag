// Defines backend API endpoint references.
export const ENDPOINTS = {
  health: "/health",
  assessments: "/assessments",
  investmentProjection: "/assessments/investment-projection",
  panelCountAdjustment: "/assessments/panel-count-adjustment",
  propertySearch: "/properties/search",
  approximateLocation: "/geolocation/approximate",
  reportsPdf: "/reports/pdf",
} as const;
