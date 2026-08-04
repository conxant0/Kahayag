// Defines backend API endpoint references.
//
// One place names every path the frontend calls, so a backend route rename is a
// single edit here rather than a search through the features that use it.
export const ENDPOINTS = {
  health: "/health",
  assessments: "/assessments",
  panelCountAdjustment: "/assessments/panel-count-adjustment",
  investmentProjection: "/assessments/investment-projection",
  propertySearch: "/properties/search",
  roofOutline: "/properties/roof-outline",
  approximateLocation: "/geolocation/approximate",
  reportsPdf: "/reports/pdf",
} as const;
