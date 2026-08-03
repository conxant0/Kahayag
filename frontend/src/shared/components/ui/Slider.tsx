// Defines the labelled range control used to nudge a single assumption.
import { useId } from "react";

import { cn } from "../../lib/cn";

/**
 * Built on a native range input, so keyboard stepping, the arrow keys, and the
 * screen-reader announcement all come for free.
 *
 * The rail is painted as a background gradient rather than a sibling element:
 * the fill has to track the value, and a gradient stop is a cheaper way to say
 * that than a second absolutely-positioned div.
 *
 * The input itself is 44px tall and transparent — that is what the pointer
 * actually hits. The 14px thumb and 3px rail are only what gets painted inside it.
 */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  formatValue = String,
  className,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (next: number) => void;
  /** Renders the current value beside the label — units belong here, not in `label`. */
  formatValue?: (value: number) => string;
  className?: string;
}) {
  const inputId = useId();
  const filledPercent = max === min ? 0 : ((value - min) / (max - min)) * 100;

  return (
    <div className={cn("flex w-full flex-col gap-3", className)}>
      <div className="flex items-start gap-3 text-[13px]">
        <label
          htmlFor={inputId}
          className="min-w-0 flex-1 font-sans text-secondary"
        >
          {label}
        </label>
        <output
          htmlFor={inputId}
          className="shrink-0 font-sans font-semibold text-ink"
        >
          {formatValue(value)}
        </output>
      </div>

      <input
        id={inputId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{
          backgroundImage: [
            "linear-gradient(to right,",
            `var(--color-cobalt) ${filledPercent}%,`,
            `var(--color-hairline) ${filledPercent}%)`,
          ].join(" "),
        }}
        className={cn(
          "h-11 w-full cursor-pointer appearance-none bg-transparent",
          // The gradient above, drawn 3px tall and centred in the 44px target.
          "bg-[length:100%_3px] bg-center bg-no-repeat",
          // Thumb: a flat 14px cobalt disc. Both engines need it spelled out.
          "[&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none",
          "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cobalt",
          "[&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:appearance-none",
          "[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0",
          "[&::-moz-range-thumb]:bg-cobalt",
        )}
      />
    </div>
  );
}
