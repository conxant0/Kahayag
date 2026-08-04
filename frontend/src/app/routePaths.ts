// Defines stable route names and paths for the assessment flow.
//
// The order below is the demo loop: landing -> locate -> trace -> energy ->
// loading -> results -> invest -> why -> brief -> report.
export const ROUTE_PATHS = {
  landing: "/",
  locate: "/locate",
  trace: "/trace",
  energy: "/energy",
  loading: "/loading",
  results: "/results",
  design: "/design",
  compare: "/compare",
  quotation: "/quotation",
  permits: "/permits",
  invest: "/invest",
  why: "/why",
  brief: "/brief",
  report: "/report",
  editLayout: "/results/layout",
  components: "/components",
  // Standalone preview for the permits prototype (T3a) — driven by a mock
  // fixture, not linked from the demo loop above.
  permitsPreview: "/permits-preview",
} as const;
