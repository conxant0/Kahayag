// Defines route composition for the assessment flow.
//
// Every path in ROUTE_PATHS is registered from the start. Screens that have not
// been built render `PendingScreen`, and each is swapped for the real component
// in the pull request that lands its feature — so the flow can be walked end to
// end throughout, and an unbuilt screen never looks like a broken route.
import { createBrowserRouter } from "react-router-dom";

import { ComponentsPage } from "../features/components-demo";
import { LandingPage } from "../features/landing";

import { PendingScreen } from "./PendingScreen";
import { ROUTE_PATHS } from "./routePaths";

export const router = createBrowserRouter([
  { path: ROUTE_PATHS.landing, element: <LandingPage /> },
  {
    path: ROUTE_PATHS.locate,
    element: <PendingScreen name="Property search" />,
  },
  { path: ROUTE_PATHS.trace, element: <PendingScreen name="Roof tracing" /> },
  {
    path: ROUTE_PATHS.energy,
    element: <PendingScreen name="Electricity use" />,
  },
  {
    path: ROUTE_PATHS.loading,
    element: <PendingScreen name="The loading screen" />,
  },
  { path: ROUTE_PATHS.results, element: <PendingScreen name="Results" /> },
  {
    path: ROUTE_PATHS.editLayout,
    element: <PendingScreen name="Layout editing" />,
  },
  {
    path: ROUTE_PATHS.invest,
    element: <PendingScreen name="The investment view" />,
  },
  { path: ROUTE_PATHS.why, element: <PendingScreen name="The explanation" /> },
  {
    path: ROUTE_PATHS.brief,
    element: <PendingScreen name="The project brief" />,
  },
  { path: ROUTE_PATHS.report, element: <PendingScreen name="The report" /> },
  { path: ROUTE_PATHS.components, element: <ComponentsPage /> },
]);
