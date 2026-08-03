import { Eyebrow, InfoPill } from "../../../shared/components/ui";
import { STEP_ROOF } from "../../../shared/assets/landing";
import { useInView } from "../../../shared/hooks/useInView";
import { cn } from "../../../shared/lib/cn";
import { TRACE_ROOF, useRoofTrace } from "../hooks/useRoofTrace";

/**
 * Step 01, played rather than described — Figma 2146:2 / 2169:49.
 *
 * A real top-down photograph with the trace happening live over it: the pointer
 * wanders in, drops six vertices around the roof, the outline closes, the usable
 * area lights up and the engine reports what it found. Then it clears and runs
 * again.
 *
 * The overlay is the same language as the app's own trace surface
 * (TracedRoofOverlay): cobalt edge, amber fill, white vertex handles. Nothing
 * here is a new visual idea — it is the product, animated.
 *
 * It sets the page's measure rather than breaking out of it: the landing column
 * is 880px because this is, and everything else lines up to that edge. Still
 * full-bleed on a phone, where the gutter would only shrink the photograph.
 *
 * Geometry is percentages inside a `container-type: size` box, so the pointer
 * moves in `cqw`/`cqh` on the compositor rather than by re-laying out `left`.
 * The box carries the map's *ratio* rather than its fixed height: at 343px the
 * two agree, and below that the photograph scales instead of being cropped out
 * from under a trace that is pinned in percentages.
 */
const MAP_PILL =
  "text-[11.85px] lg:text-[18.95px] px-[11.37px] py-[7.58px] lg:px-[18.2px] lg:py-[12.13px] gap-[7.58px] lg:gap-[12.13px]";

/**
 * The overlay's viewBox carries the surface's own ratio, so the non-uniform
 * `preserveAspectRatio="none"` scale is in fact uniform. That buys two things a
 * square viewBox could not: a stroke of even thickness at every angle, and a
 * `pathLength`-normalised dash — `vector-effect: non-scaling-stroke` measures
 * dashes in screen units and ignores pathLength, which draws the outline as a
 * dotted line instead of a growing one.
 */
const ASPECT = 1.4485;
const vx = (value: number) => value * ASPECT;

/** The polygon, and the six edges as separate paths so each draws on its beat. */
const EDGES = TRACE_ROOF.map((from, index) => {
  const to = TRACE_ROOF[(index + 1) % TRACE_ROOF.length];
  return {
    d: `M ${vx(from.x)} ${from.y} L ${vx(to.x)} ${to.y}`,
    key: `${index}`,
  };
});

const POINTS = TRACE_ROOF.map((v) => `${vx(v.x)},${v.y}`).join(" ");

/**
 * The area read-out hangs off the roof's top corner rather than a fixed spot on
 * the photograph, so it points at the thing it measured. Derived from the shape,
 * so moving a vertex moves the label with it.
 */
const AREA_CORNER = TRACE_ROOF.reduce((top, v) => (v.y < top.y ? v : top));

export function RoofTraceDemo() {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.3 });
  const trace = useRoofTrace(inView);

  return (
    <figure className="m-0 -mx-(--gutter) flex w-[calc(100%+var(--gutter)*2)] flex-col gap-3 lg:mx-0 lg:w-full lg:gap-[19.2px]">
      <div
        ref={ref}
        className="@container-size relative aspect-[1.4485] w-full overflow-hidden border-y border-hairline lg:rounded-[25.6px] lg:border lg:border-hairline"
      >
        <img
          src={STEP_ROOF}
          alt=""
          width={1600}
          height={1100}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />

        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-500 ease-brand",
            trace.visible ? "opacity-100" : "opacity-0",
          )}
        >
          <svg
            viewBox={`0 0 ${100 * ASPECT} 100`}
            preserveAspectRatio="none"
            className="absolute inset-0 block size-full"
            aria-hidden="true"
            focusable="false"
          >
            <polygon
              points={POINTS}
              fill="var(--color-sun)"
              fillOpacity={trace.measured ? 0.2 : trace.closed ? 0.34 : 0}
              style={{
                transition: `fill-opacity ${trace.closed ? 420 : 260}ms var(--ease-brand)`,
              }}
            />

            {EDGES.map((edge, index) => (
              <path
                key={edge.key}
                d={edge.d}
                fill="none"
                stroke="var(--color-cobalt)"
                strokeLinecap="round"
                className="stroke-[0.62] lg:stroke-[0.34]"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={index < trace.edges ? 0 : 1}
                style={{
                  transition: `stroke-dashoffset ${trace.travelMs}ms linear`,
                }}
              />
            ))}
          </svg>

          {TRACE_ROOF.map((vertex, index) => {
            const placed = index < trace.placed;
            return (
              <span
                key={`${vertex.x}-${vertex.y}`}
                aria-hidden="true"
                className={cn(
                  "absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cobalt bg-white",
                  "transition-[scale,opacity] duration-200 ease-brand lg:size-4.75 lg:border-[3px]",
                  placed ? "scale-100 opacity-100" : "scale-0 opacity-0",
                )}
                style={{ left: `${vertex.x}%`, top: `${vertex.y}%` }}
              >
                {placed ? (
                  <span className="roof-click-ping absolute inset-0 -m-2 rounded-full border-2 border-cobalt lg:-m-3" />
                ) : null}
              </span>
            );
          })}

          {/* Engine output. Cobalt informs; it arrives only once measured.
           * The wrapper does the anchoring — bottom-centre on the corner — so
           * the pill itself is free to keep using translate for its own rise. */}
          <span
            className="absolute -translate-x-1/2 -translate-y-full"
            style={{
              left: `${AREA_CORNER.x}%`,
              top: `calc(${AREA_CORNER.y}% - 10px)`,
            }}
          >
            <InfoPill
              tone="ink"
              className={cn(
                "transition-[opacity,translate] duration-500 ease-brand",
                MAP_PILL,
                trace.measured
                  ? "translate-y-0 opacity-100"
                  : "translate-y-1 opacity-0",
              )}
            >
              Usable area · 48 m²
            </InfoPill>
          </span>

          <InfoPill
            tone="ink"
            className={cn(
              "absolute top-[80%] left-[4%] transition-[opacity,translate] delay-100 duration-500 ease-brand",
              MAP_PILL,
              trace.measured
                ? "translate-y-0 opacity-100"
                : "translate-y-1 opacity-0",
            )}
          >
            <span
              aria-hidden="true"
              className="size-[8.53px] shrink-0 rounded-[1.9px] bg-[#273c60] lg:size-[13.65px] lg:rounded-[3px]"
            />
            12 panels · 6.4 kWp
          </InfoPill>
        </div>

        {/* The pointer. Anchored so the arrow's tip, not its box, lands on the
         * vertex it is about to drop. */}
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute top-0 left-0 transition-[translate,opacity] ease-brand",
            trace.showCursor ? "opacity-100" : "opacity-0",
          )}
          style={{
            translate: `${trace.cursor.x}cqw ${trace.cursor.y}cqh`,
            transitionDuration: `${trace.travelMs}ms`,
          }}
        >
          <svg
            viewBox="0 0 24 24"
            className="block size-5 translate-x-[-21%] translate-y-[-10%] lg:size-7"
          >
            <path
              d="M5 2.6 L5 19.4 L9.5 15.2 L12.2 21.4 L15.2 20 L12.5 14 L18.6 13.8 Z"
              fill="#fcfaf5"
              stroke="#1a1917"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>

      {/* The caption is the frame: it says the picture is live, and where the
       * roof is, without putting either claim inside the image. */}
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-(--gutter) lg:px-0">
        <Eyebrow
          size="section"
          tone="cobalt"
          as="span"
          className="inline-flex items-center gap-2 lg:gap-2.5"
        >
          <span
            aria-hidden="true"
            className="roof-live-dot size-1.5 shrink-0 rounded-full bg-cobalt lg:size-2.5"
          />
          Live trace
        </Eyebrow>

        <span className="font-sans text-(length:--t-caption) font-medium text-tertiary-ink">
          Pajo, Lapu-Lapu City · six corners, one estimate
        </span>

        <span className="sr-only">
          A satellite view of a roof being traced: six corners are placed around
          the roof, and the traced area is measured at 48 m² of usable space —
          room for 12 panels totalling 6.4 kWp.
        </span>
      </figcaption>
    </figure>
  );
}
