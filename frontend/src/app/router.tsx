// Defines route composition for the assessment flow.
//
// Every path in ROUTE_PATHS is registered from the start. Screens that have not
// been built render `PendingScreen`, and each is swapped for the real component
// in the pull request that lands its feature — so the flow can be walked end to
// end throughout, and an unbuilt screen never looks like a broken route.
import { createBrowserRouter } from "react-router-dom";

import { ComponentsPage } from "../features/components-demo";
import { LandingPage } from "../features/landing";
import { PropertyPage } from "../features/property";
import { RecommendationPage, WhyPage } from "../features/recommendation";
import { EditLayoutPage, ResultsPage } from "../features/results";

import { RoofPage } from "../features/roof";

import { PendingScreen } from "./PendingScreen";
import { ROUTE_PATHS } from "./routePaths";

export const router = createBrowserRouter([
  { path: ROUTE_PATHS.landing, element: <LandingPage /> },
  { path: ROUTE_PATHS.locate, element: <PropertyPage /> },
  { path: ROUTE_PATHS.trace, element: <RoofPage /> },
  {
    path: ROUTE_PATHS.energy,
    element: <PendingScreen name="Electricity use" />,
  },
  {
    path: ROUTE_PATHS.loading,
    element: <PendingScreen name="The loading screen" />,
  },
  { path: ROUTE_PATHS.results, element: <ResultsPage /> },
  {
    path: ROUTE_PATHS.editLayout,
    element: <EditLayoutPage />,
  },
  {
    path: ROUTE_PATHS.invest,
    element: <RecommendationPage />,
  },
  { path: ROUTE_PATHS.why, element: <WhyPage /> },
  {
    path: ROUTE_PATHS.brief,
    element: <PendingScreen name="The project brief" />,
  },
  { path: ROUTE_PATHS.report, element: <PendingScreen name="The report" /> },
  { path: ROUTE_PATHS.components, element: <ComponentsPage /> },
]);
