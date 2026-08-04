// Defines a two-option pill toggle used on compare and design screens.
import { cn } from "../../lib/cn";

export type SegmentedToggleOption<T extends string> = {
  value: T;
  label: string;
};

export function SegmentedToggle<T extends string>({
  value,
  options,
  onChange,
  className,
  ariaLabel,
}: {
  value: T;
  options: ReadonlyArray<SegmentedToggleOption<T>>;
  onChange: (value: T) => void;
  className?: string;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex rounded-pill bg-[#f2eee4] p-1",
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-pill px-[22px] py-2.5 font-sans text-[13.5px] transition-colors duration-150 ease-brand",
              selected
                ? "bg-ink font-semibold text-paper"
                : "font-medium text-secondary hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
