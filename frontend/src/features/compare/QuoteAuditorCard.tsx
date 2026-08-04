// Defines the dashed quote-auditor stub on the compare screen.
import { useRef } from "react";

import { Button } from "../../shared/components/ui";

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

  return (
    <article
      className="flex h-full min-h-[420px] flex-col items-center rounded-[20px] border border-dashed border-[#d8d2c4] bg-[#fbf8f1] px-6 pt-[30px] pb-6"
      aria-label="Quote auditor stub"
    >
      <div className="flex flex-col items-center">
        <h2 className="font-serif text-[26px] font-medium text-ink">
          Quote auditor
        </h2>
        <span className="mt-2.5 rounded-pill bg-[#fff4cc] px-[11px] py-1.5 font-sans text-[10.5px] font-semibold tracking-[0.5px] text-[#7a5c00]">
          Expert AI service
        </span>
      </div>

      <div className="mt-12 flex size-[58px] items-center justify-center rounded-pill border border-hairline bg-white text-ink">
        <DocumentIcon />
      </div>

      <h3 className="mt-5 text-center font-serif text-[22px] font-medium leading-7 text-ink">
        Let AI audit an outside quote
      </h3>
      <p className="mt-2.5 text-center font-sans text-[12.5px] leading-5 text-tertiary">
        Upload a PDF from any installer. We benchmark their pricing and
        performance against current market standards.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      <div className="mt-auto w-full pt-8">
        <Button
          variant="ghost"
          fullWidth
          className="h-[52px] gap-[9px] border-hairline bg-white text-[13.5px] text-ink hover:border-tertiary"
          onClick={() => inputRef.current?.click()}
        >
          <UploadIcon />
          Audit my PDF quote
        </Button>
      </div>
    </article>
  );
}
