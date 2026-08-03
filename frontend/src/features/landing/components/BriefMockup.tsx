import { KAHAYAG_MARK } from "../../../shared/assets/brand";
import { Eyebrow } from "../../../shared/components/ui";
import { useInView } from "../../../shared/hooks/useInView";
import { cn } from "../../../shared/lib/cn";
import {
  LINE_STEP_MS,
  SPEC_STEP_MS,
  useBriefBuild,
} from "../hooks/useBriefBuild";

/**
 * The Step 03 project brief, written rather than shown — Figma 2146:37 / 2169:117.
 *
 * Two counter-rotated sheets on a paper surface, carrying the same footprint and
 * aspect as the Step 01 trace: the two steps are the same kind of moment — the
 * product doing its work — so they should occupy the page identically.
 *
 * The build is staged (useBriefBuild): the sheets settle, the masthead lands,
 * the rule draws, the four figures arrive in order, then the site assumptions
 * rule themselves in. It reads as the document being produced, which is exactly
 * what the step claims happens.
 *
 * The card is decorative — the same figures are stated in prose in the flow — so
 * it is hidden from assistive tech behind one caption.
 */
const SPECS: Array<[string, string]> = [
  ["System size", "5.2 kW"],
  ["Annual output", "6,840 kWh"],
  ["Est. installed cost", "₱350,000"],
  ["Simple payback", "4.8 years"],
];

const SITE_LINES = ["96%", "90%", "95%", "69%"];

/** Shared rise-into-place transition; `stage` decides when each part uses it. */
const RISE =
  "transition-[opacity,translate] duration-500 ease-brand motion-reduce:transition-none";

export function BriefMockup() {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.3 });
  const brief = useBriefBuild(inView);

  return (
    <figure className="m-0 -mx-(--gutter) flex w-[calc(100%+var(--gutter)*2)] flex-col gap-3 lg:mx-0 lg:w-full lg:gap-[19.2px]">
      <div
        ref={ref}
        className="relative flex aspect-[1.4485] w-full items-center justify-center overflow-hidden border-y border-hairline bg-[#f4f1ea] px-6 lg:rounded-[25.6px] lg:border lg:border-hairline"
      >
        <div
          aria-hidden="true"
          className="relative flex w-[62%] justify-center lg:w-[52%]"
        >
          {/* Back sheet — settles a beat behind the front one. */}
          <div
            className={cn(
              "absolute inset-0 rounded-[9.5px] border-[0.95px] border-[#e0d6c4] bg-white/60 lg:rounded-[15.2px] lg:border-[1.5px]",
              "transition-[opacity,rotate,scale] duration-700 ease-brand motion-reduce:transition-none",
              brief.has("sheets")
                ? "scale-100 -rotate-4 opacity-100"
                : "scale-95 rotate-0 opacity-0",
            )}
          />

          <div
            className={cn(
              "relative flex w-full flex-col gap-2.75 rounded-[11.4px] border border-hairline bg-white px-4.25 pt-3.75 pb-4.25",
              "lg:gap-[18.4px] lg:rounded-[18.2px] lg:border-[1.6px] lg:px-[27.2px] lg:pt-6 lg:pb-[27.2px]",
              "transition-[opacity,rotate,scale] duration-700 ease-brand motion-reduce:transition-none",
              brief.has("sheets")
                ? "scale-100 rotate-3 opacity-100"
                : "scale-95 rotate-0 opacity-0",
            )}
          >
            <div
              className={cn(
                "flex w-full items-center gap-[7.6px] lg:gap-3",
                RISE,
                brief.has("masthead")
                  ? "translate-y-0 opacity-100"
                  : "translate-y-1 opacity-0",
              )}
            >
              <img
                src={KAHAYAG_MARK}
                alt=""
                width={35}
                height={35}
                className="size-5.5 shrink-0 object-contain lg:size-[35.2px]"
              />

              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-sans text-[11.85px] font-semibold tracking-[-0.12px] text-[#16140e] lg:text-[18.95px]">
                  Project Brief
                </span>
                <span className="font-sans text-[9px] font-medium text-tertiary-ink lg:text-[14.4px]">
                  Pajo, Lapu-Lapu City
                </span>
              </div>

              {/* Cobalt informs: the badge marks the part a model wrote. */}
              <span
                className={cn(
                  "shrink-0 rounded-pill bg-cobalt px-[6.4px] py-1 font-sans text-[8.5px] font-semibold text-white lg:px-[10.4px] lg:py-1.5 lg:text-[13.65px]",
                  "transition-transform duration-300 ease-brand motion-reduce:transition-none",
                  brief.has("masthead") ? "scale-100" : "scale-0",
                )}
              >
                AI
              </span>
            </div>

            {/* The rule draws rather than appears — the first mark on the page. */}
            <div
              className={cn(
                "h-[0.95px] w-full origin-left bg-[#e5dccb] lg:h-[1.5px]",
                "transition-transform duration-500 ease-brand motion-reduce:transition-none",
                brief.has("rule") ? "scale-x-100" : "scale-x-0",
              )}
            />

            <dl className="flex w-full flex-col gap-[6.4px] text-[9.95px] lg:gap-[10.4px] lg:text-[15.9px]">
              {SPECS.map(([label, value], index) => (
                <div
                  key={label}
                  style={{ transitionDelay: `${index * SPEC_STEP_MS}ms` }}
                  className={cn(
                    "flex items-center justify-between",
                    RISE,
                    brief.has("specs")
                      ? "translate-y-0 opacity-100"
                      : "translate-y-1 opacity-0",
                  )}
                >
                  <dt className="font-sans font-medium text-tertiary-ink">
                    {label}
                  </dt>
                  <dd className="font-sans font-semibold text-[#16140e]">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            <p
              className={cn(
                "font-sans text-[9.95px] font-semibold tracking-[0.2px] text-[#16140e] lg:text-[15.9px]",
                RISE,
                brief.has("lines")
                  ? "translate-y-0 opacity-100"
                  : "translate-y-1 opacity-0",
              )}
            >
              Site assumptions
            </p>

            <div className="flex w-full flex-col gap-[5.6px] lg:gap-2.25">
              {SITE_LINES.map((width, index) => (
                <div
                  key={`${width}-${index}`}
                  style={{
                    width,
                    transitionDelay: `${index * LINE_STEP_MS}ms`,
                  }}
                  className={cn(
                    "h-[4.24px] origin-left rounded-[2.8px] bg-[#e8e1d3] lg:h-[6.8px]",
                    "transition-transform duration-420 ease-brand motion-reduce:transition-none",
                    brief.has("lines") ? "scale-x-100" : "scale-x-0",
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Same framing device as Step 01: the caption says what the picture is. */}
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-(--gutter) lg:px-0">
        <Eyebrow
          size="section"
          tone="cobalt"
          as="span"
          className="inline-flex items-center gap-2 lg:gap-2.5"
        >
          Project brief
        </Eyebrow>

        <span className="font-sans text-(length:--t-caption) font-medium text-tertiary-ink">
          One page · what an installer prices against
        </span>

        <span className="sr-only">
          A one-page project brief for Pajo, Lapu-Lapu City: 5.2 kW system,
          6,840 kWh annual output, ₱350,000 estimated installed cost, 4.8 year
          simple payback.
        </span>
      </figcaption>
    </figure>
  );
}
