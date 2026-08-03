import { HERO_BG } from "../../../shared/assets/brand";
import { cn } from "../../../shared/lib/cn";

/**
 * The hero's sky — a sunrise photograph that dissolves into paper (#FCFAF5) so
 * the fold into The Gap has no seam.
 *
 * The photo occupies the top of the hero and is masked away over its last third
 * rather than being covered by an overlay. Masking means the pixels actually
 * stop, so the bottom of the hero is the same paper as the next section — no
 * near-white band that reads as a different colour once you scroll.
 *
 * Everything below the tagline sits on plain paper. That is deliberate: the CTA
 * is a sun-yellow pill, and a gold sky behind it would erase it. The saturated
 * band covers the sky and the mark, which is where a sunset belongs anyway.
 *
 * The brandbook's "flat always — no gradients" rule still governs every
 * component. This is the one deliberate exception: it is sky, not a surface.
 */
const FADE =
  "linear-gradient(to bottom, #000 0%, #000 54%, rgb(0 0 0 / 0.55) 76%, rgb(0 0 0 / 0.18) 90%, transparent 100%)";

export function HeroBackdrop({
  parallax = false,
  className,
}: {
  /** Drifts the sky against the panel's tilt, which is what reads as depth. */
  parallax?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden",
        className,
      )}
    >
      {/* Anchored near the horizon line so the sunrise sky stays in frame. The
       * sun sits around 28% down the photograph, so anchoring much below this
       * centres the roof field and crops the sky out entirely.
       * Under parallax it drifts *with* the pointer while the panel tilts
       * toward it — opposing directions is what separates the two planes. The
       * slight overscale hides the edges the drift would otherwise expose. */}
      <img
        src={HERO_BG}
        alt=""
        className={cn(
          "absolute inset-x-0 top-0 h-[80%] w-full object-cover object-[50%_35%]",
          parallax &&
            "translate-x-[calc(var(--px,0)*11px)] translate-y-[calc(var(--py,0)*7px)] scale-[1.05] " +
              "will-change-transform",
        )}
        style={{ maskImage: FADE, WebkitMaskImage: FADE }}
      />

      {/* A veil that thins back out rather than settling on opaque paper.
       * Ending on a solid colour covered the page's grid for the height of the
       * hero; the photo's own mask is what dissolves it, and this only softens
       * the middle of that dissolve. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, transparent 54%, rgb(252 250 245 / 0.4) 74%, rgb(252 250 245 / 0.18) 88%, transparent 97%)",
        }}
      />
    </div>
  );
}
