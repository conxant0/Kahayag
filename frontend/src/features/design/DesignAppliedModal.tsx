import { useEffect, useRef } from "react";

import { Button, ButtonLink } from "../../shared/components/ui";
import { ROUTE_PATHS } from "../../app/routePaths";
import { peso } from "../../shared/lib/currency";

function CheckMark() {
  return (
    <svg
      width={28}
      height={28}
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M7 14.5L12 19.5L21 9.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DesignAppliedModal({
  open,
  onKeepEditing,
  systemKwp,
  totalInvestmentPhp,
}: {
  open: boolean;
  onKeepEditing: () => void;
  systemKwp?: number;
  totalInvestmentPhp?: number;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Move focus into the dialog on open and hand it back on close — without
  // this, keyboard focus stays on the obscured page behind the overlay and
  // Escape has nothing to act on.
  useEffect(() => {
    if (!open) {
      return;
    }
    const previous = document.activeElement;
    dialogRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    return () => {
      if (previous instanceof HTMLElement) {
        previous.focus();
      }
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const sizeLabel =
    typeof systemKwp === "number" ? `${systemKwp.toFixed(1)} kWp` : "system";
  const pricedNote =
    typeof totalInvestmentPhp === "number"
      ? ` Priced at ${peso(totalInvestmentPhp)} against current vendor rates.`
      : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="design-applied-title"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onKeepEditing();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-[440px] rounded-[24px] border border-hairline bg-white p-8 shadow-[0_20px_40px_rgba(26,23,18,0.16)]"
      >
        <div className="mx-auto flex size-16 items-center justify-center rounded-pill bg-sun text-ink">
          <CheckMark />
        </div>
        <h2
          id="design-applied-title"
          className="mt-5 text-center font-serif text-[32px] font-medium leading-none text-ink"
        >
          Design applied.
        </h2>
        <p className="mt-3 text-center font-sans text-[15px] leading-6 text-secondary">
          Your {sizeLabel} build is saved to this property.{pricedNote} It is
          ready to compare and quote.
        </p>
        <div className="mt-7 flex flex-col gap-2">
          <ButtonLink to={ROUTE_PATHS.compare} fullWidth>
            See comparison
          </ButtonLink>
          <Button
            variant="ghost"
            fullWidth
            onClick={onKeepEditing}
            className="border-transparent bg-transparent text-secondary hover:border-transparent hover:text-ink"
          >
            Keep editing the design
          </Button>
        </div>
      </div>
    </div>
  );
}
