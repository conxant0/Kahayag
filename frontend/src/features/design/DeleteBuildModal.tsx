// Defines the confirmation modal for deleting a custom or user build.
import { useEffect, useRef } from "react";

import { Button } from "../../shared/components/ui";

export function DeleteBuildModal({
  open,
  buildLabel,
  pending = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  buildLabel: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const previous = document.activeElement;
    dialogRef.current?.querySelector<HTMLElement>("button")?.focus();
    return () => {
      if (previous instanceof HTMLElement) {
        previous.focus();
      }
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-build-title"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !pending) {
          onCancel();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-[420px] rounded-[24px] border border-hairline bg-white p-8 shadow-[0_20px_40px_rgba(26,23,18,0.16)]"
      >
        <h2
          id="delete-build-title"
          className="font-serif text-[28px] font-medium leading-none text-ink"
        >
          Delete build?
        </h2>
        <p className="mt-3 font-sans text-[15px] leading-6 text-secondary">
          <span className="font-semibold text-ink">{buildLabel}</span> will be
          removed from this session. This cannot be undone.
        </p>
        <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="ghost"
            disabled={pending}
            onClick={onCancel}
            className="border-hairline bg-white text-ink sm:min-w-[7.5rem]"
          >
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={onConfirm}
            className="bg-ember text-paper hover:bg-ember hover:shadow-none sm:min-w-[7.5rem]"
          >
            {pending ? "Deleting…" : "Delete build"}
          </Button>
        </div>
      </div>
    </div>
  );
}
