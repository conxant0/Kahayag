import { Reveal } from "../../../shared/components/ui";

import { EditorialSection } from "./EditorialSection";

/**
 * Who it's for — Figma 2141:54 / 2169:150.
 *
 * The second line is the brandbook's "never overclaim" rule in practice: the
 * page says plainly what it is not before asking for the click.
 */
export function WhoSection() {
  return (
    <EditorialSection
      title="Made for homes and shops catching Philippine sun."
      titleSize="who"
      titleId="who-its-for"
      gap="prose"
      className="pt-10 pb-8 lg:pt-16 lg:pb-[19.2px]"
    >
      <Reveal>
        <p className="font-sans text-(length:--t-who-body) text-tertiary-ink">
          Not a replacement for a site inspection — it makes the inspection
          worth booking.
        </p>
      </Reveal>
    </EditorialSection>
  );
}
