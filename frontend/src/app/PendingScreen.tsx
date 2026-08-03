// Defines the stand-in rendered by routes whose feature has not landed yet.
import { ContentScreen } from "../shared/components/layout";
import { ButtonLink } from "../shared/components/ui";

import { ROUTE_PATHS } from "./routePaths";

/**
 * Every path in `ROUTE_PATHS` is registered from the start, so a wrong URL and
 * an unbuilt screen are visibly different things: a typo gets the router's own
 * not-found, and a real route gets this.
 *
 * Rendering it through `ContentScreen` is deliberate — the shell stays exercised
 * on every route while the features are still arriving, and a layout regression
 * shows up before the screen that would have caught it exists.
 *
 * Each of these disappears in the pull request that lands its feature.
 */
export function PendingScreen({ name }: { name: string }) {
  return (
    <ContentScreen
      eyebrow="Not built yet"
      title={`${name} is still on the way.`}
      cta={<ButtonLink to={ROUTE_PATHS.landing}>Back to the start</ButtonLink>}
    >
      <p className="font-sans text-[15px] text-secondary">
        This route is registered so the flow can be walked end to end, but the
        screen itself has not been implemented. Nothing here is wired to the
        API.
      </p>
    </ContentScreen>
  );
}
