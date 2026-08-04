// Defines the canvas diagram source selector for solver builds and uploaded quotes.
import type { DiagramSourceOption } from "./designViewModel";
import { cn } from "../../shared/lib/cn";

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1)}…`;
}

export function DiagramSourcePicker({
  value,
  options,
  onChange,
  className,
}: {
  value: string;
  options: DiagramSourceOption[];
  onChange: (value: string) => void;
  className?: string;
}) {
  if (options.length <= 1) {
    return null;
  }

  return (
    <div
      role="radiogroup"
      aria-label="Diagram source"
      className={cn("flex min-w-0 flex-1 flex-col gap-2", className)}
    >
      <p className="font-sans text-[10px] font-semibold tracking-[1px] text-tertiary uppercase">
        Show diagram for
      </p>
      <div className="flex min-w-0 flex-wrap gap-2">
        {options.map((source) => {
          const selected = source.value === value;
          return (
            <button
              key={source.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(source.value)}
              className={cn(
                "min-w-[8.5rem] max-w-full rounded-[12px] border px-3 py-2 text-left transition-[background-color,border-color,box-shadow] duration-150 ease-brand",
                selected
                  ? "border-ink bg-white shadow-[0_2px_8px_rgba(26,23,18,0.08)]"
                  : "border-hairline bg-white/80 text-secondary hover:border-tertiary hover:text-ink",
              )}
            >
              <span
                className={cn(
                  "block truncate font-sans text-[13px] font-semibold",
                  selected ? "text-ink" : "text-secondary",
                )}
              >
                {source.label}
              </span>
              <span className="mt-0.5 block truncate font-sans text-[11px] leading-snug text-tertiary">
                {truncate(source.description, 28)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
