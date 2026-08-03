import { Reveal } from "../../../shared/components/ui";

import { BriefMockup } from "./BriefMockup";
import { EditorialSection } from "./EditorialSection";

/** Step 03 — Figma 2141:33 / 2169:114. */
export function StepThreeSection() {
  return (
    <EditorialSection
      eyebrow="Step 03"
      title="Walk into quotes with a brief they respect."
      titleId="step-03"
      className="pt-10 pb-8 lg:pt-[70.4px] lg:pb-[25.6px]"
    >
      <Reveal className="w-full">
        <BriefMockup />
      </Reveal>
    </EditorialSection>
  );
}
