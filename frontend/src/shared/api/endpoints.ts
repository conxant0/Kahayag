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
  approximateLocation: "/geolocation/approximate",
  reportsPdf: "/reports/pdf",
  designsBootstrap: "/designs/bootstrap",
  designsOptimise: "/designs/optimise",
  designsMutate: "/designs/mutate",
  designsBuilds: "/designs/builds",
  designsBuildComponent: (buildId: string) => `/designs/builds/${buildId}/components`,
  designsBuildDuplicate: (buildId: string) => `/designs/builds/${buildId}/duplicate`,
  designsBuildDelete: (buildId: string) => `/designs/builds/${buildId}/delete`,
  designsCatalogOptions: "/designs/catalog-options",
  designsRejections: (solveId: string) => `/designs/solves/${solveId}/rejections`,
  designsQuotation: (buildId: string) => `/designs/quotation/${buildId}`,
  designsQuoteAudit: "/designs/quote-audit",
  designsAgent: "/designs/agent",
  designsExplain: "/designs/explain",
  permitsAssess: "/permits/assess",
  permitsChat: "/permits/chat",
} as const;
