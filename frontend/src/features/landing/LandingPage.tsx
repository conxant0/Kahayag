import { SiteFooter } from "../../shared/components/layout/SiteFooter";

import { ClosingSection } from "./components/ClosingSection";
import { GapSection } from "./components/GapSection";
import { GridBackdrop } from "./components/GridBackdrop";
import { HeroSection } from "./components/HeroSection";
import { QuoteSection } from "./components/QuoteSection";
import { StepOneSection } from "./components/StepOneSection";
import { StepThreeSection } from "./components/StepThreeSection";
import { StepTwoSection } from "./components/StepTwoSection";
import { WhoSection } from "./components/WhoSection";

/**
 * The V3 landing page — Figma 2131:3 (mobile) and 2169:27 (desktop).
 *
 * One responsive page: a single column on mobile, and on desktop a
 * full-viewport hero above a centred 656px editorial column. Every section is
 * composed from the shared ui library; nothing here re-implements a control.
 */
export function LandingPage() {
  return (
    // `snap-column` gives the page a soft rest point at each section boundary —
    // proximity, so it only assists when you stop near one. The hero and every
    // section below it are direct children, so each becomes a stop.
    // No `bg-paper` here on purpose: an opaque background on this wrapper
    // paints *over* the -z-10 grid below it. The body already carries paper.
    <div className="snap-column min-h-svh">
      <a
        href="#main"
        className="sr-only rounded-pill bg-sun px-4 py-2 font-sans text-sm font-semibold text-ink focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
      >
        Skip to content
      </a>

      {/* Sits behind every section. The hero covers it with its photograph, so
       * the grid reads as the paper the rest of the page is printed on. */}
      <GridBackdrop />

      <HeroSection />

      {/* Sections carry their own padding, balanced 40/32 on a phone so each
       * block has the same air at both ends. This gap tops that up from a
       * single place — small on mobile, where the padding is already doing the
       * work, and generous on desktop. */}
      <main id="main" className="flex flex-col gap-2 pb-15 lg:gap-12 lg:pb-15">
        <GapSection />
        <StepOneSection />
        <StepTwoSection />
        <StepThreeSection />
        <QuoteSection />
        <WhoSection />
        <ClosingSection />
      </main>

      <SiteFooter />
    </div>
  );
}
