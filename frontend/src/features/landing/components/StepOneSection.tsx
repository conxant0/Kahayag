import { Reveal } from "../../../shared/components/ui";

import { EditorialSection } from "./EditorialSection";
import { RoofTraceDemo } from "./RoofTraceDemo";

/** Step 01 — Figma 2141:11 / 2169:46. */
export function StepOneSection() {
  return (
    <EditorialSection
      eyebrow="Step 01"
      title="Trace the roof you already have."
      titleId="step-01"
      className="pt-10 pb-8 lg:pt-[70.4px] lg:pb-[25.6px]"
    >
      <Reveal className="w-full">
        <RoofTraceDemo />
      </Reveal>
    </EditorialSection>
  );
}
