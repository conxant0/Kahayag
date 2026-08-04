// Defines the quote-auditor card wired to POST /designs/quote-audit.
import { useRef, useState } from "react";

import { Button } from "../../shared/components/ui";
import type { QuoteAuditResponse } from "../../shared/api/types";
import { peso } from "../../shared/lib/currency";
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

function severityClass(severity: QuoteAuditResponse["findings"][number]["severity"]) {
  if (severity === "warning") {
    return "border-ember/30 bg-[#fff5f2] text-ember";
  }
  if (severity === "positive") {
    return "border-green-700/20 bg-[#f2faf4] text-green-800";
  }
  return "border-hairline bg-white text-secondary";
}

function extractedSummary(result: QuoteAuditResponse): string {
  const parts: string[] = [];
  if (typeof result.extracted_total_php === "number") {
    parts.push(`Total ${peso(result.extracted_total_php)}`);
  }
  if (typeof result.extracted_system_kwp === "number") {
    parts.push(`${result.extracted_system_kwp.toFixed(2)} kWp`);
  }
  if (typeof result.extracted_panel_count === "number") {
    parts.push(`${result.extracted_panel_count} panels`);
  }
  return parts.length > 0 ? parts.join(" · ") : "No totals parsed from upload";
}

export function QuoteAuditorCard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const audit = useQuoteAudit();
  const [result, setResult] = useState<QuoteAuditResponse | null>(null);

  const handleFile = (file: File | undefined) => {
    if (!file) {
      return;
    }
    setResult(null);
    audit.mutate(file, {
      onSuccess: (payload) => setResult(payload),
    });
  };

  return (
    <article
      className="flex h-full min-h-[420px] flex-col rounded-[20px] border border-dashed border-[#d8d2c4] bg-[#fbf8f1] px-6 pt-[30px] pb-6"
      aria-label="Quote auditor"
    >
      <div className="flex flex-col items-center">
        <h2 className="font-serif text-[26px] font-medium text-ink">Quote auditor</h2>
        <span className="mt-2.5 rounded-pill bg-[#fff4cc] px-[11px] py-1.5 font-sans text-[10.5px] font-semibold tracking-[0.5px] text-[#7a5c00]">
          Expert AI service
        </span>
      </div>

      {result ? (
        <div className="mt-8 flex flex-1 flex-col gap-3 overflow-y-auto">
          <p className="font-sans text-[12px] font-semibold tracking-[0.8px] text-tertiary uppercase">
            Audit · {result.filename}
          </p>
          <div className="rounded-[12px] border border-hairline bg-white px-3.5 py-3">
            <p className="font-sans text-[10px] font-medium tracking-[1px] text-tertiary uppercase">
              Parsed from upload
            </p>
            <p className="mt-1 font-sans text-[13px] font-semibold text-ink">
              {extractedSummary(result)}
            </p>
          </div>
          <p className="font-sans text-sm leading-6 text-ink">{result.summary}</p>
          <ul className="grid gap-2">
            {result.findings.map((finding) => (
              <li
                key={`${finding.category}-${finding.message}`}
                className={`rounded-[12px] border p-3 font-sans text-[13px] leading-5 ${severityClass(finding.severity)}`}
              >
                {finding.message}
              </li>
            ))}
          </ul>
          <Button
            variant="ghost"
            className="mt-auto border-hairline bg-white text-ink"
            onClick={() => {
              setResult(null);
              if (inputRef.current) {
                inputRef.current.value = "";
                inputRef.current.click();
              }
            }}
          >
            Audit another quote
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-12 flex size-[58px] items-center justify-center rounded-pill border border-hairline bg-white text-ink">
            <DocumentIcon />
          </div>

          <h3 className="mt-5 text-center font-serif text-[22px] font-medium leading-7 text-ink">
            Let AI audit an outside quote
          </h3>
          <p className="mt-2.5 text-center font-sans text-[12.5px] leading-5 text-tertiary">
            Upload a PDF, photo, or text quote from any installer. We read the
            document and benchmark pricing and capacity against your Kahayag design.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_QUOTE_TYPES}
            className="sr-only"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />

          <div className="mt-auto w-full pt-8">
            <Button
              variant="ghost"
              fullWidth
              disabled={audit.isPending}
              className="h-[52px] gap-[9px] border-hairline bg-white text-[13.5px] text-ink hover:border-tertiary"
              onClick={() => inputRef.current?.click()}
            >
              <UploadIcon />
              {audit.isPending ? "Reading quote…" : "Upload quote to audit"}
            </Button>
            {audit.error ? (
              <p className="mt-3 font-sans text-sm text-ember" role="alert">
                {audit.error.message}
              </p>
            ) : null}
          </div>
        </>
      )}
    </article>
  );
}
