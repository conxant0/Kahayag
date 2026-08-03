// Defines the optional-attachment card, in its resting and failed states.
import type { ReactNode } from "react";

import { cn } from "../../lib/cn";
import { CameraIcon } from "./icons";

export type UploadCardVariant = "default" | "error";

// The lens colour matches the disc it sits on, so the icon reads as cut out of it.
const LENS_COLOUR: Record<UploadCardVariant, string> = {
  default: "#2144C7",
  error: "#B23511",
};

/**
 * Cobalt informs at rest; ember interrupts when the attachment failed.
 *
 * The failed state always offers one way on — the whole card stays pressable and
 * `action` becomes "Retry" — because this input is optional, and a card that
 * dead-ends would block a step the user never had to take.
 */
export function UploadCard({
  title,
  hint,
  action,
  variant = "default",
  onClick,
  className,
}: {
  title: string;
  hint: string;
  /** Trailing affordance: an arrow at rest, a word like "Retry" after a failure. */
  action?: ReactNode;
  variant?: UploadCardVariant;
  onClick?: () => void;
  className?: string;
}) {
  const failed = variant === "error";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-card border-[1.5px] py-3 pr-[18px] pl-3.5 text-left",
        "transition-[background-color,border-color,color] duration-150 ease-brand",
        failed ? "border-ember bg-ember-wash" : "border-cobalt bg-cobalt-wash",
        className,
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-[20px]",
          failed ? "bg-ember" : "bg-cobalt",
        )}
      >
        <CameraIcon lens={LENS_COLOUR[variant]} />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn(
            "font-sans text-sm font-semibold",
            failed ? "text-ember" : "text-ink",
          )}
        >
          {title}
        </span>
        <span className="font-sans text-xs text-secondary">{hint}</span>
      </span>

      <span
        className={cn(
          "shrink-0 font-sans font-semibold text-cobalt",
          failed ? "text-[13px]" : "text-base",
        )}
      >
        {action ?? <span aria-hidden="true">→</span>}
      </span>
    </button>
  );
}
