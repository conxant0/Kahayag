import { useEffect, useId, useMemo, useRef, useState } from "react";

import { kahayagSunriseMarkup } from "../../assets/brand";
import { cn } from "../../lib/cn";
import { decorativeSvg, scopeSvg, stillEntranceCss } from "../../lib/scopeSvg";

/**
 * The animated kahayag mark — the sun rising behind the landforms.
 *
 * The artwork and its timeline live in `kahayag-sunrise.svg`: the landforms drop
 * in on a stagger, the sun rises through a horizon clip, and a glint sweeps the
 * disc every 7s. The file carries its own prefers-reduced-motion rule, so the
 * still frame comes for free.
 *
 * It is inlined and scoped rather than referenced with `<img>` because browsers
 * share one SVG document — and one animation timeline — per URL, so an `<img>`
 * that has already finished never plays again. See `scopeSvg`.
 *
 * The sunrise then plays **once per page load**. Inlining alone would replay it
 * on every mount, which means a client-side navigation back to the landing page
 * would restart it — jarring, because the mark is already familiar by then.
 * After the entrance has run, later mounts render the settled frame and only the
 * ambient glint keeps moving. A real reload re-evaluates this module and the
 * sunrise plays again.
 */
const ENTRANCE_MS = 2000;

let entrancePlayed = false;

export function KahayagSunrise({
  size = 140,
  className,
}: {
  /** Number of px, or any CSS length — pass a clamp() for a fluid mark. */
  size?: number | string;
  className?: string;
}) {
  // useId is stable across a mount and unique per instance.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

  // Read the flag once per mount. StrictMode's immediate remount in development
  // still plays, because the flag is not set until the entrance has finished.
  const [settled] = useState(() => entrancePlayed);
  const settledRef = useRef(settled);

  useEffect(() => {
    if (settledRef.current) return undefined;
    const done = window.setTimeout(() => {
      entrancePlayed = true;
    }, ENTRANCE_MS);
    return () => window.clearTimeout(done);
  }, []);

  const markup = useMemo(() => {
    const scoped = decorativeSvg(scopeSvg(kahayagSunriseMarkup, uid));
    if (!settled) return scoped;

    // Re-use the mark's own still-state rules rather than guessing which layers
    // move; they are appended so they win on order.
    const still = stillEntranceCss(scoped);
    return still ? scoped.replace("</style>", `${still}</style>`) : scoped;
  }, [uid, settled]);

  return (
    <span
      className={cn(
        "inline-block shrink-0 [&>svg]:block [&>svg]:size-full",
        className,
      )}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
