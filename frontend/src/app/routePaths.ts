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
  invest: "/invest",
  why: "/why",
  brief: "/brief",
  report: "/report",
  reportSaved: "/report/saved",
  editLayout: "/results/layout",
  components: "/components",
} as const;
