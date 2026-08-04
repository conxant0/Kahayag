// Defines the plain-language quote audit modal for uploaded installer quotes.
import { useEffect, useRef } from "react";

import { Button } from "../../shared/components/ui";
import { cn } from "../../shared/lib/cn";
import type { CompareQuoteView } from "./quoteCompareViewModel";

function verdictBadgeClass(tone: CompareQuoteView["verdictTone"]): string {
  switch (tone) {
    case "positive":
      return "bg-[#e8f5ec] text-green-800";
    case "caution":
      return "bg-[#fff4cc] text-[#7a5c00]";
    default:
      return "bg-[#fff0eb] text-ember";
  }
}

function AuditList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "positive" | "warning";
}) {
  if (items.length === 0) {
    return null;
  }

  const bulletClass = tone === "positive" ? "bg-green-700" : "bg-ember";

  return (
    <section>
      <p className="font-sans text-[9.5px] font-medium tracking-[1.1px] text-tertiary uppercase">
        {title}
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {items.map((item) => (
          <li
            key={item}
            className="flex gap-2 font-sans text-[13px] leading-[19px] text-secondary"
          >
            <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-pill", bulletClass)} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function QuoteAuditModal({
  open,
  view,
  onClose,
}: {
  open: boolean;
  view: CompareQuoteView;
  onClose: () => void;
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-4 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quote-audit-title"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="flex max-h-[min(88vh,720px)] w-full max-w-[520px] flex-col overflow-hidden rounded-[24px] border border-hairline bg-white shadow-[0_20px_40px_rgba(26,23,18,0.16)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-hairline px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-sans text-[10px] font-semibold tracking-[1px] text-tertiary uppercase">
                Quote review
              </p>
              <h2
                id="quote-audit-title"
                className="mt-1 font-serif text-[26px] font-medium leading-tight text-ink"
              >
                {view.label}
              </h2>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-pill px-[11px] py-1.5 font-sans text-[10.5px] font-semibold tracking-[0.5px]",
                verdictBadgeClass(view.verdictTone),
              )}
            >
              {view.verdictLabel}
            </span>
          </div>
          <p className="mt-3 font-sans text-[13px] leading-6 text-secondary">
            Plain-language checks — no solar jargon required.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-5">
            {view.insight ? (
              <section className="rounded-[14px] bg-[#fbf6e8] px-4 py-3.5">
                <p className="font-sans text-[9.5px] font-medium tracking-[1.1px] text-tertiary uppercase">
                  Summary
                </p>
                <p className="mt-2 font-serif text-[15px] leading-6 text-ink italic">
                  {view.insight}
                </p>
              </section>
            ) : null}

            <AuditList title="What's good" items={view.pros} tone="positive" />
            <AuditList title="Watch out for" items={view.cons} tone="warning" />

            {view.questionsForInstaller.length > 0 ? (
              <section>
                <p className="font-sans text-[9.5px] font-medium tracking-[1.1px] text-tertiary uppercase">
                  Ask your installer
                </p>
                <ul className="mt-2 flex flex-col gap-2">
                  {view.questionsForInstaller.map((question) => (
                    <li
                      key={question}
                      className="rounded-[12px] border border-hairline bg-[#fcfaf5] px-3 py-2.5 font-sans text-[13px] leading-[19px] text-ink"
                    >
                      {question}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </div>

        <div className="border-t border-hairline px-6 py-4">
          <Button fullWidth onClick={onClose} className="h-[48px]">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
