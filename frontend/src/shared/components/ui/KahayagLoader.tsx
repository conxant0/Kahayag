import { memo, useEffect, useId, useMemo, useRef } from "react";

import { kahayagLoaderMarkup } from "../../assets/brand";
import { cn } from "../../lib/cn";
import { decorativeSvg, scopeSvg } from "../../lib/scopeSvg";

/**
 * The kahayag mark as a loading indicator — the sun breathes while the rays and
 * panels wave through on a stagger, so the logo itself reads as "working".
 *
 * SVG markup is injected once on mount so parent re-renders (status text,
 * progress ticks) do not restart the CSS animation timeline.
 */
export const KahayagLoader = memo(function KahayagLoader({
  size = 140,
  label = "Loading",
  className,
}: {
  /** Number of px, or any CSS length — pass a clamp() for a fluid mark. */
  size?: number | string;
  label?: string;
  className?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const markup = useMemo(
    () => decorativeSvg(scopeSvg(kahayagLoaderMarkup, uid)),
    [uid],
  );
  const artRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const art = artRef.current;
    if (!art || art.childElementCount > 0) {
      return;
    }

    art.innerHTML = markup;
  }, [markup]);

  return (
    <span
      className={cn("inline-block shrink-0", className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span
        ref={artRef}
        className="block size-full [&>svg]:block [&>svg]:size-full"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
});
