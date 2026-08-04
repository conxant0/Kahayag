// Defines the canvas diagram source selector for solver builds and uploaded quotes.
import { useEffect, useRef, useState } from "react";

import type { DiagramSourceOption } from "./designViewModel";
import { cn } from "../../shared/lib/cn";

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1)}…`;
}

function MoreIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="6" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="18" r="1.5" fill="currentColor" />
    </svg>
  );
}

function BuildSourceMenu({
  label,
  disabled,
  onDuplicate,
  onDelete,
}: {
  label: string;
  disabled?: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const close = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) {
        return;
      }
      setOpen(false);
    };

    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={menuRef} className="absolute top-1.5 right-1.5">
      <button
        type="button"
        aria-label={`Actions for ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className={cn(
          "flex size-7 items-center justify-center rounded-[8px] text-secondary",
          "transition-[background-color,color] duration-150 ease-brand",
          "hover:bg-[#f2eee4] hover:text-ink disabled:pointer-events-none disabled:opacity-45",
        )}
      >
        <MoreIcon />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label={`${label} actions`}
          className="absolute top-full right-0 z-20 mt-1 min-w-[9rem] overflow-hidden rounded-[12px] border border-hairline bg-white py-1 shadow-[0_8px_24px_rgba(26,23,18,0.12)]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={(event) => {
              event.stopPropagation();
              setOpen(false);
              onDuplicate();
            }}
            className="block w-full px-3 py-2 text-left font-sans text-[13px] text-ink hover:bg-[#f7f4ed]"
          >
            Duplicate
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={(event) => {
              event.stopPropagation();
              setOpen(false);
              onDelete();
            }}
            className="block w-full px-3 py-2 text-left font-sans text-[13px] text-ember hover:bg-[#fff5f3]"
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function DiagramSourcePicker({
  value,
  options,
  onChange,
  onDuplicate,
  onDelete,
  managePending = false,
  className,
}: {
  value: string;
  options: DiagramSourceOption[];
  onChange: (value: string) => void;
  onDuplicate?: (buildId: string) => void;
  onDelete?: (buildId: string) => void;
  managePending?: boolean;
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
          const manageable =
            source.kind === "build" && source.manageable && onDuplicate && onDelete;

          return (
            <div key={source.value} className="relative">
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange(source.value)}
                className={cn(
                  "min-w-[8.5rem] max-w-full rounded-[12px] border py-2 text-left transition-[background-color,border-color,box-shadow] duration-150 ease-brand",
                  manageable ? "px-3 pr-9" : "px-3",
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
              {manageable ? (
                <BuildSourceMenu
                  label={source.label}
                  disabled={managePending}
                  onDuplicate={() => onDuplicate(source.value)}
                  onDelete={() => onDelete(source.value)}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
