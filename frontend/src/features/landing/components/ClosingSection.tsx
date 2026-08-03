import { ButtonLink } from "../../../shared/components/ui";
import { ROUTE_PATHS } from "../../../app/routePaths";
import { KAHAYAG_MARK } from "../../../shared/assets/brand";

import { EditorialSection } from "./EditorialSection";

/**
 * Closing CTA — Figma 2140:49 / 2169:153.
 *
 * The desktop master draws this pill at 972.8px, which is a scaling artefact of
 * the frame. At the page's 880px measure a full-width pill reads as a banner
 * rather than a button, so it keeps the hero's proportions instead — the two
 * CTAs bookend the page and should look like the same control.
 */
export function ClosingSection() {
  return (
    <EditorialSection
      title="Your roof is already working. Make it pay."
      titleSize="closing"
      titleId="closing-cta"
      align="center"
      gap="closing"
      className="py-12 lg:py-[89.6px]"
    >
      <img
        src={KAHAYAG_MARK}
        alt=""
        width={102}
        height={102}
        className="order-first size-16 object-contain lg:size-[102.4px]"
      />

      <ButtonLink to={ROUTE_PATHS.locate} fullWidth className="sm:w-85">
        Get started
      </ButtonLink>

      <p className="font-sans text-(length:--t-caption) font-medium text-tertiary-ink">
        Free · No account
      </p>
    </EditorialSection>
  );
}
