// Defines backend API endpoint references.
export const ENDPOINTS = {
  health: "/health",
  assessments: "/assessments",
  panelCountAdjustment: "/assessments/panel-count-adjustment",
  propertySearch: "/properties/search",
  roofOutline: "/properties/roof-outline",
  approximateLocation: "/geolocation/approximate",
  reportsPdf: "/reports/pdf",
} as const;
