// Defines route composition for the assessment flow.
//
// Each screen is registered here as its feature lands under `src/features/`.
import { createBrowserRouter } from "react-router-dom";

import { ROUTE_PATHS } from "./routePaths";

export const router = createBrowserRouter([
  {
    path: ROUTE_PATHS.landing,
    element: (
      <main className="p-8 font-sans text-ink">
        <h1 className="font-serif text-2xl">Kahayag Energy</h1>
      </main>
    ),
  },
]);
