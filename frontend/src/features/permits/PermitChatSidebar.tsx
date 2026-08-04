// Defines the permits chat sidebar: the one live part of this preview,
// wired to POST /permits/chat (commit 7ecb4d7). Mirrors
// `frontend/src/features/quotation/AskEngineSidebar.tsx`'s layout, chip
// styling, and message treatment. When the endpoint returns an updated
// `applicant`, it is handed back to the page so the checklist and findings
// recompute from it (permitsViewModel.deriveAssessment) — the chat can set
// inputs, not just answer questions.
import { useState } from "react";

import { Chip } from "../../shared/components/ui";
import type { ApplicantFormValues } from "./ApplicantForm";
import { fromApiApplicant, toApiApplicant } from "./permitsViewModel";
import { usePermitChat } from "./usePermitChat";

function EngineIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <rect x="4" y="7" width="16" height="12" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="9" cy="12" r="1.2" fill="currentColor" />
      <circle cx="15" cy="12" r="1.2" fill="currentColor" />
      <path d="M9 16h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 7V5.5a2 2 0 0 1 4 0V7" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M5 12h12M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const SUGGESTED_QUESTIONS = [
  "Do I need a notarized authorization?",
  "What track am I on?",
  "I'm not the registered owner — what changes?",
] as const;

export function PermitChatSidebar({
  applicant,
  onApplicantChange,
  propertyAddress,
  systemKwp,
}: {
  applicant: ApplicantFormValues;
  onApplicantChange: (values: ApplicantFormValues) => void;
  propertyAddress: string;
  systemKwp: number;
}) {
  const [reply, setReply] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const chat = usePermitChat();

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    setReply(null);
    setDraft("");
    try {
      const response = await chat.mutateAsync({
        applicant: toApiApplicant(applicant),
        system_kwp: systemKwp,
        build_id: null,
        property_address: propertyAddress,
        user_text: trimmed,
      });
      setReply(response.reply);
      onApplicantChange(fromApiApplicant(response.applicant));
    } catch {
      // chat.error surfaces below.
    }
  };

  return (
    <section
      className="flex flex-col gap-4 rounded-[20px] border border-hairline bg-white p-5 print:hidden"
      aria-label="Ask about your permit packet"
    >
      <header className="flex items-center gap-2 text-ink">
        <EngineIcon />
        <h2 className="font-sans text-sm font-semibold">Ask about your packet</h2>
      </header>

      <p className="font-sans text-[13px] leading-5 text-secondary">
        Answers can update your details above — the checklist and findings
        recompute from whatever you confirm here.
      </p>

      <div className="flex flex-wrap gap-2">
        {SUGGESTED_QUESTIONS.map((question) => (
          <Chip
            key={question}
            onClick={() => send(question)}
            disabled={chat.isPending}
            className="border-transparent bg-[#fff4cc] text-[12px] text-[#7a5c00] hover:border-transparent hover:text-[#7a5c00]"
          >
            {question}
          </Chip>
        ))}
      </div>

      {reply ? (
        <p className="rounded-[14px] bg-[#fbf6e8] p-3 font-sans text-sm leading-5 text-ink">
          {reply}
        </p>
      ) : null}

      <form
        className="flex items-center gap-2 rounded-pill border border-hairline bg-[#fcfaf5] py-1.5 pr-1.5 pl-4"
        onSubmit={(event) => {
          event.preventDefault();
          send(draft);
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Type a question…"
          className="min-w-0 flex-1 bg-transparent font-sans text-sm text-ink outline-none placeholder:text-tertiary"
          disabled={chat.isPending}
        />
        <button
          type="submit"
          disabled={chat.isPending || !draft.trim()}
          aria-label="Send question"
          className="flex size-10 items-center justify-center rounded-pill bg-ink text-paper disabled:opacity-45"
        >
          <SendIcon />
        </button>
      </form>

      {chat.error ? (
        <p className="font-sans text-sm text-ember" role="alert">
          {chat.error.message}
        </p>
      ) : null}
    </section>
  );
}
