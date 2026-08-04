// Defines route composition for the assessment flow.
//
// Every path in ROUTE_PATHS is registered. Unbuilt screens used to render
// `PendingScreen` until the pull request that landed the feature swapped it for
// the real component; the last of those swaps has happened, so every path now
// resolves to the screen it names.
import { createBrowserRouter } from "react-router-dom";

import { AssessmentPage } from "../features/assessment";
import { ComponentsPage } from "../features/components-demo";
import { LandingPage } from "../features/landing";
import { LoadingPage } from "../features/loading";
import { PropertyPage } from "../features/property";
import { RecommendationPage, WhyPage } from "../features/recommendation";
import { BriefPage, ReportPage } from "../features/reports";
import { EditLayoutPage, ResultsPage } from "../features/results";
import { RoofPage } from "../features/roof";

import { ROUTE_PATHS } from "./routePaths";
import { PendingScreen } from "./PendingScreen";

export const router = createBrowserRouter([
  { path: ROUTE_PATHS.landing, element: <LandingPage /> },
  { path: ROUTE_PATHS.locate, element: <PropertyPage /> },
  { path: ROUTE_PATHS.trace, element: <RoofPage /> },
  { path: ROUTE_PATHS.energy, element: <AssessmentPage /> },
  { path: ROUTE_PATHS.loading, element: <LoadingPage /> },
  { path: ROUTE_PATHS.results, element: <ResultsPage /> },
  { path: ROUTE_PATHS.design, element: <PendingScreen name="AI Design" /> },
  { path: ROUTE_PATHS.compare, element: <PendingScreen name="Compare builds" /> },
  { path: ROUTE_PATHS.quotation, element: <PendingScreen name="Quotation" /> },
  { path: ROUTE_PATHS.editLayout, element: <EditLayoutPage /> },
  { path: ROUTE_PATHS.invest, element: <RecommendationPage /> },
  { path: ROUTE_PATHS.why, element: <WhyPage /> },
  { path: ROUTE_PATHS.brief, element: <BriefPage /> },
  { path: ROUTE_PATHS.report, element: <ReportPage /> },
  { path: ROUTE_PATHS.components, element: <ComponentsPage /> },
]);
