import type { CSSProperties } from "react";

import { ButtonLink, KahayagSunrise } from "../../../shared/components/ui";
import { usePointerParallax } from "../../../shared/hooks/usePointerParallax";
import { cn } from "../../../shared/lib/cn";
import { ROUTE_PATHS } from "../../../app/routePaths";

import { HeroBackdrop } from "./HeroBackdrop";

/**
 * Hero — Figma 2138:2 + 2131:24 (mobile poster) and 2169:28 (desktop).
 *
 * The frames set the wordmark straight onto paper. With a photograph behind it
 * the copy needs its own surface, so the five elements now sit together in one
 * frosted panel: it holds the text at full contrast without flattening the sky,
 * and it gives the hero a centre on both breakpoints.
 *
 * The mark plays the kahayag-sunrise timeline; the copy is staggered to land as
 * the sun clears the horizon, so the whole hero reads as one sunrise rather than
 * four separate entrances.
 */
const RISE_DELAY = { wordmark: 900, tagline: 1050, cta: 1200, caption: 1350 };

/**
 * Frosted glass: a paper veil, a blur, and a lit top edge. No drop shadow — the
 * brandbook's flat rule still holds, so the panel is defined by its edge and its
 * blur rather than by floating above the page.
 */
const GLASS =
  "rounded-[28px] border border-white/70 bg-paper/85 backdrop-blur-2xl backdrop-saturate-150 " +
  "supports-[not(backdrop-filter:blur(0))]:bg-paper/95";

function rise(delay: number) {
  return { "--hero-delay": `${delay}ms` } as CSSProperties;
}

export function HeroSection() {
  // Publishes --px/--py for the layers below. Pointer devices only.
  const { ref, enabled: parallax } = usePointerParallax<HTMLElement>();

  return (
    // `isolate` keeps the backdrop's -z-10 inside the header rather than
    // sliding it behind the page background. `perspective` is what turns the
    // panel's rotation into depth rather than a skew.
    <header
      ref={ref}
      className={cn(
        "relative isolate flex min-h-svh w-full flex-col justify-center px-4 py-12 sm:px-6 lg:px-0 lg:py-0",
        parallax && "perspective-[1400px]",
      )}
    >
      <HeroBackdrop parallax={parallax} />

      <div
        className={cn(
          "mx-auto flex w-full max-w-104 flex-col items-center gap-4 px-5 py-8 text-center sm:px-7 sm:py-10 lg:max-w-136 lg:gap-6.5 lg:px-14 lg:py-14",
          GLASS,
          // The panel tilts *toward* the pointer, a couple of degrees at most —
          // enough to read as a physical sheet, not enough to distort the type.
          parallax &&
            "transform-[rotateX(calc(var(--py,0)*-1.5deg))_rotateY(calc(var(--px,0)*1.9deg))] " +
              "will-change-transform",
        )}
      >
        {/* One fluid mark rather than a phone copy and a desktop copy — it
         * scales with the viewport and never crowds a 320px screen. */}
        <KahayagSunrise size="clamp(5rem, 24vw, 8.75rem)" />

        <h1
          style={rise(RISE_DELAY.wordmark)}
          className="hero-rise font-serif text-[clamp(2.75rem,13vw,3.625rem)] leading-none font-medium text-ink lg:text-[84px]"
        >
          kahayag
        </h1>

        <p
          style={rise(RISE_DELAY.tagline)}
          className="hero-rise font-serif text-[clamp(1rem,4.4vw,1.1875rem)] text-balance text-secondary italic lg:text-2xl"
        >
          What is the sun worth on your roof?
        </p>

        <div
          style={rise(RISE_DELAY.cta)}
          className="hero-rise w-full pt-2 lg:w-85 lg:pt-0"
        >
          <ButtonLink to={ROUTE_PATHS.locate} fullWidth>
            Get started
          </ButtonLink>
        </div>

        <p
          style={rise(RISE_DELAY.caption)}
          className="hero-rise font-sans text-xs font-medium text-tertiary-ink lg:text-[13px]"
        >
          Free · No account needed
        </p>
      </div>
    </header>
  );
}
