// Defines stable route names and paths for the assessment flow.
//
// The order below is the demo loop: landing -> locate -> trace -> energy ->
// plans -> loading -> results -> invest -> why -> brief -> report.
export const ROUTE_PATHS = {
  landing: "/",
  locate: "/locate",
  trace: "/trace",
  energy: "/energy",
  plans: "/plans",
  loading: "/loading",
  results: "/results",
  design: "/design",
  compare: "/compare",
  quotation: "/quotation",
  invest: "/invest",
  why: "/why",
  brief: "/brief",
  report: "/report",
  editLayout: "/results/layout",
  components: "/components",
} as const;
