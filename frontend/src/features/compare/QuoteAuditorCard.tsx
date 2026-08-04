// Defines the quote-auditor upload card wired to POST /designs/quote-audit.
import { useRef, useState } from "react";

import { Button } from "../../shared/components/ui";
import { useDesignStore } from "../../state/designStore";
import { compareUtilityCardClass } from "./CompareCardsGrid";
import { useQuoteAudit } from "./useQuoteAudit";

const ACCEPTED_QUOTE_TYPES =
  ".pdf,.txt,.csv,.md,.png,.jpg,.jpeg,.webp,image/*,application/pdf,text/plain";

function DocumentIcon() {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M7 3.5h7.5L19 8v12.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M14.5 3.5V8H19" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M9 13h6M9 16.5h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M12 16V5M12 5l-3.5 3.5M12 5l3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 18.5v1A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function QuoteAuditorCard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const audit = useQuoteAudit();
  const uploadedCount = useDesignStore((state) => state.quoteAuditResults.length);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);

  const handleFiles = async (fileList: FileList | null) => {
    const files = fileList ? Array.from(fileList) : [];
    if (files.length === 0) {
      return;
    }

    setUploadWarnings([]);
    try {
      const batch = await audit.mutateAsync(files);
      if (batch.failures.length > 0) {
        setUploadWarnings(batch.failures);
      }
    } catch {
      // mutation error is surfaced below
    } finally {
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  return (
    <article className={compareUtilityCardClass} aria-label="Quote auditor">
      <div className="flex flex-col items-center text-center">
        <h2 className="font-serif text-[26px] font-medium leading-none text-ink">
          Quote auditor
        </h2>
        <span className="mt-2.5 rounded-pill bg-[#fff4cc] px-[11px] py-1.5 font-sans text-[10.5px] font-semibold tracking-[0.5px] text-[#7a5c00]">
          Expert AI service
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
        <div className="flex size-[58px] items-center justify-center rounded-pill border border-hairline bg-[#fbf8f1] text-ink">
          <DocumentIcon />
        </div>

        <h3 className="mt-5 font-serif text-[22px] font-medium leading-7 text-ink">
          {uploadedCount > 0 ? "Add another installer quote" : "Get a plain-language quote review"}
        </h3>
        <p className="mt-2.5 max-w-[17rem] font-sans text-[12.5px] leading-5 text-tertiary">
          {uploadedCount > 0
            ? `${uploadedCount} quote${uploadedCount === 1 ? "" : "s"} are ready to compare above. Upload another PDF or photo for the same review.`
            : "Upload a quote from any installer. We check the price, parts, and completeness — and tell you what to ask before you sign."}
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_QUOTE_TYPES}
        multiple
        className="sr-only"
        onChange={(event) => void handleFiles(event.target.files)}
      />

      <div className="mt-auto w-full">
        <Button
          variant="ghost"
          fullWidth
          disabled={audit.isPending}
          className="h-[52px] gap-[9px] border-hairline bg-white text-[13.5px] text-ink hover:border-tertiary"
          onClick={() => inputRef.current?.click()}
        >
          <UploadIcon />
          {audit.isPending
            ? "Reading quotes…"
            : uploadedCount > 0
              ? "Upload more quotes"
              : "Upload quotes to audit"}
        </Button>
      </div>

      {uploadWarnings.length > 0 ? (
        <ul className="mt-3 grid gap-2" role="alert">
          {uploadWarnings.map((warning) => (
            <li
              key={warning}
              className="rounded-[12px] border border-ember/30 bg-[#fff5f2] px-3 py-2 font-sans text-[13px] text-ember"
            >
              {warning}
            </li>
          ))}
        </ul>
      ) : null}

      {audit.error ? (
        <p className="mt-3 font-sans text-sm text-ember" role="alert">
          {audit.error.message}
        </p>
      ) : null}
    </article>
  );
}
