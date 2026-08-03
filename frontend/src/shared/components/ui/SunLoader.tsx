// Defines the brand loading motif: a sun disc orbited by a cobalt arc.
import { cn } from "../../lib/cn";

// Geometry is expressed against an 84-unit square and scaled by the `size` prop,
// so the arc keeps its relationship to the disc at 40px and at 140px alike.
const VIEWBOX = 84;
const CENTRE = VIEWBOX / 2;
const DISC_RADIUS = 28.8;
const ORBIT_RADIUS = 36;

/**
 * Flat always: a solid disc for the reward, a cobalt arc for the engine doing
 * the work. No gradient, no shadow, no glow.
 *
 * Under reduced motion the arc holds its position instead of spinning — the
 * `.sun-loader-arc` animation is dropped in the stylesheet. The shape still
 * reads as "working", it just stops moving.
 *
 * `role="status"` with a visually hidden label, because the disc itself carries
 * no meaning to anyone who cannot see it.
 */
export function SunLoader({
  size = 140,
  label = "Loading",
  className,
}: {
  size?: number;
  label?: string;
  className?: string;
}) {
  // 105° of sweep, opening from the top-left. Large-arc and sweep flags stay 0/1.
  const startAngle = (-135 * Math.PI) / 180;
  const startX = CENTRE + ORBIT_RADIUS * Math.cos(startAngle);
  const startY = CENTRE + ORBIT_RADIUS * Math.sin(startAngle);
  const arc = [
    `M ${startX.toFixed(2)} ${startY.toFixed(2)}`,
    `A ${ORBIT_RADIUS} ${ORBIT_RADIUS} 0 0 1 ${CENTRE + ORBIT_RADIUS} ${CENTRE}`,
  ].join(" ");

  return (
    <span
      role="status"
      aria-live="polite"
      style={{ width: size, height: size }}
      className={cn("inline-block shrink-0", className)}
    >
      <svg
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        width={size}
        height={size}
        aria-hidden="true"
        focusable="false"
      >
        <circle
          cx={CENTRE}
          cy={CENTRE}
          r={DISC_RADIUS}
          fill="var(--color-sun)"
        />

        <g
          className="sun-loader-arc"
          style={{ transformOrigin: `${CENTRE}px ${CENTRE}px` }}
        >
          <path
            d={arc}
            fill="none"
            stroke="var(--color-cobalt)"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          {/* Leading dot, so the sweep has a head and reads as travelling. */}
          <circle
            cx={startX.toFixed(2)}
            cy={startY.toFixed(2)}
            r="2.6"
            fill="var(--color-cobalt)"
          />
        </g>
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}
