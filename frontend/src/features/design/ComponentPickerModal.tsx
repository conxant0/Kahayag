// Defines the catalog picker modal for swapping canvas components.
import { useEffect, useState } from "react";

import type { CatalogOption, CatalogPickerSlot } from "../../shared/api/types";
import { cn } from "../../shared/lib/cn";
import { CanvasSlotIcon, SLOT_ACCENT } from "./canvasSlotIcons";
import { canvasSlotHeader } from "./designViewModel";
import { useCatalogOptions } from "./useDesignActions";

const STATUS_LABELS: Record<CatalogOption["status"], string> = {
  selected: "Current",
  recommended: "Best fit",
  compatible: "Compatible",
  incompatible: "Not compatible",
};

function CatalogOptionRow({
  option,
  slot,
  disabled,
  onSelect,
}: {
  option: CatalogOption;
  slot: CatalogPickerSlot;
  disabled: boolean;
  onSelect: (option: CatalogOption) => void;
}) {
  const accent = SLOT_ACCENT[slot];
  const blocked = option.status === "incompatible" || option.status === "selected";

  return (
    <li>
      <button
        type="button"
        disabled={disabled || blocked}
        onClick={() => onSelect(option)}
        className={cn(
          "flex w-full items-start gap-3 rounded-[14px] border px-3 py-2.5 text-left transition-colors",
          option.status === "recommended" && "border-sun bg-[#fffbeb]",
          option.status === "selected" && "border-hairline bg-[#f7f4ed]",
          option.status === "compatible" && "border-hairline bg-white hover:border-cobalt/30",
          option.status === "incompatible" && "border-hairline bg-[#fafafa] opacity-60",
          !blocked && !disabled && "hover:shadow-sm",
        )}
      >
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-[10px]",
            accent.bg,
          )}
        >
          <CanvasSlotIcon slot={slot} size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-sans text-[12px] font-semibold text-cobalt">{option.brand}</p>
              <p className="font-sans text-[13px] font-bold text-ink">{option.model}</p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-pill px-2 py-0.5 font-sans text-[10px] font-semibold uppercase",
                option.status === "recommended" && "bg-sun text-ink",
                option.status === "selected" && "bg-[#e8e4da] text-secondary",
                option.status === "compatible" && "bg-cobalt-wash text-cobalt",
                option.status === "incompatible" && "bg-[#f2eee4] text-tertiary",
              )}
            >
              {STATUS_LABELS[option.status]}
            </span>
          </div>
          <p className="mt-0.5 font-sans text-[11px] text-secondary">{option.summary}</p>
          {option.reason ? (
            <p className="mt-1 font-sans text-[11px] leading-4 text-ember">{option.reason}</p>
          ) : null}
        </div>
      </button>
    </li>
  );
}

export function ComponentPickerModal({
  open,
  slot,
  mode,
  onClose,
  onSelect,
  isPending,
}: {
  open: boolean;
  slot: CatalogPickerSlot | null;
  mode: "swap" | "add";
  onClose: () => void;
  onSelect: (option: CatalogOption) => void;
  isPending: boolean;
}) {
  const catalog = useCatalogOptions();
  const [options, setOptions] = useState<CatalogOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !slot) {
      return;
    }
    setError(null);
    void catalog
      .mutateAsync(slot)
      .then(setOptions)
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Could not load catalog.");
        setOptions([]);
      });
  }, [open, slot, catalog.mutateAsync]);

  if (!open || !slot) {
    return null;
  }

  const title =
    mode === "add"
      ? `Add ${canvasSlotHeader(slot).toLowerCase()}`
      : `Swap ${canvasSlotHeader(slot).toLowerCase()}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-[20px] bg-paper shadow-[0_24px_64px_rgba(26,23,18,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="border-b border-hairline px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-sans text-lg font-semibold text-ink">{title}</h2>
              <p className="mt-1 font-sans text-[12px] text-secondary">
                Best-fit options are highlighted. Incompatible parts stay visible but cannot be
                selected.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close picker"
              onClick={onClose}
              className="rounded-pill px-2 py-1 font-sans text-sm text-secondary hover:bg-[#f2eee4]"
            >
              ✕
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {catalog.isPending ? (
            <p className="font-sans text-sm text-secondary">Loading catalog…</p>
          ) : error ? (
            <p className="font-sans text-sm text-ember" role="alert">
              {error}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {options.map((option) => (
                <CatalogOptionRow
                  key={option.id}
                  option={option}
                  slot={slot}
                  disabled={isPending}
                  onSelect={onSelect}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
