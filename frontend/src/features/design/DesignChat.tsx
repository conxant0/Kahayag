// Defines the unified Build / Ask design assistant chat panel.
import { useEffect, useRef, useState } from "react";

import type { SolverGoal } from "../../shared/api/types";
import { cn } from "../../shared/lib/cn";
import { ASK_AI_CHIPS, GOAL_LABELS } from "./designViewModel";
import { classifyMessageIntent } from "./designChatIntent";
import {
  useDesignAgent,
  useExplainDesign,
  useOptimiseDesign,
} from "./useDesignActions";

export type DesignChatMode = "build" | "ask";

type UserMessage = {
  id: string;
  kind: "user";
  content: string;
};

type AssistantMessage = {
  id: string;
  kind: "assistant";
  content: string;
  tone?: "answer" | "status";
};

type ConfirmationMessage = {
  id: string;
  kind: "confirmation";
  content: string;
  userText: string;
};

type ChatMessage = UserMessage | AssistantMessage | ConfirmationMessage;

const MODE_OPTIONS = [
  { value: "build" as const, label: "Build" },
  { value: "ask" as const, label: "Ask" },
] as const;

const GOAL_SHORTCUTS: SolverGoal[] = ["budget", "backup", "independence"];

function SendIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

function SparkIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 20L14.5 9.5M12.5 7.5l2-2 4 4-2 2-4-4ZM9 5l.6 1.4L11 7l-1.4.6L9 9l-.6-1.4L7 7l1.4-.6L9 5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function nextMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ModeToggle({
  value,
  onChange,
  disabled,
}: {
  value: DesignChatMode;
  onChange: (value: DesignChatMode) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="tablist"
      aria-label="Design assistant mode"
      className="inline-flex rounded-pill bg-[#f2eee4] p-0.5"
    >
      {MODE_OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-pill px-3 py-1.5 font-sans text-[12px] font-semibold transition-colors disabled:opacity-45",
              selected ? "bg-ink text-paper" : "text-secondary hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function EmptyState({
  disabled,
  onPrompt,
  onGoal,
  onAuto,
}: {
  disabled: boolean;
  onPrompt: (text: string) => void;
  onGoal: (goal: SolverGoal) => void;
  onAuto: () => void;
}) {
  return (
    <div className="flex h-full flex-col justify-end gap-5 pb-2">
      <div className="space-y-2">
        <p className="font-sans text-[11px] font-semibold tracking-[1.2px] text-tertiary uppercase">
          Questions
        </p>
        <ul className="flex flex-col gap-1.5">
          {ASK_AI_CHIPS.map((chip) => (
            <li key={chip}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onPrompt(chip)}
                className="w-full rounded-[12px] px-2 py-2 text-left font-sans text-[13px] text-secondary transition-colors hover:bg-white/80 hover:text-ink disabled:opacity-45"
              >
                {chip}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <p className="font-sans text-[11px] font-semibold tracking-[1.2px] text-tertiary uppercase">
          Quick actions
        </p>
        <ul className="flex flex-col gap-1.5">
          {GOAL_SHORTCUTS.map((goal) => (
            <li key={goal}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onGoal(goal)}
                className="w-full rounded-[12px] px-2 py-2 text-left font-sans text-[13px] text-secondary transition-colors hover:bg-white/80 hover:text-ink disabled:opacity-45"
              >
                {GOAL_LABELS[goal]}
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              disabled={disabled}
              onClick={onAuto}
              className="flex w-full items-center gap-2 rounded-[12px] px-2 py-2 text-left font-sans text-[13px] font-semibold text-[#7a5c00] transition-colors hover:bg-[#fff4cc]/70 disabled:opacity-45"
            >
              <SparkIcon />
              {GOAL_LABELS.auto}
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}

export function DesignChat() {
  const [mode, setMode] = useState<DesignChatMode>("build");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const explain = useExplainDesign();
  const agent = useDesignAgent();
  const optimise = useOptimiseDesign();

  const busy = explain.isPending || agent.isPending || optimise.isPending;
  const error = explain.error ?? agent.error ?? optimise.error;

  useEffect(() => {
    const node = scrollRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages, busy]);

  const appendUser = (content: string) => {
    setMessages((current) => [
      ...current,
      { id: nextMessageId(), kind: "user", content },
    ]);
  };

  const appendAssistant = (content: string, tone: "answer" | "status" = "answer") => {
    setMessages((current) => [
      ...current,
      { id: nextMessageId(), kind: "assistant", content, tone },
    ]);
  };

  const appendConfirmation = (content: string, userText: string) => {
    setMessages((current) => [
      ...current,
      { id: nextMessageId(), kind: "confirmation", content, userText },
    ]);
  };

  const resolveConfirmation = (messageId: string, next: ChatMessage) => {
    setMessages((current) =>
      current.map((message) => (message.id === messageId ? next : message)),
    );
  };

  const answerQuestion = async (question: string) => {
    const { explanation } = await explain.mutateAsync(question);
    appendAssistant(explanation);
  };

  const previewChange = async (userText: string) => {
    const preview = await agent.mutateAsync({ user_text: userText, dry_run: true });
    if (preview.requires_confirmation) {
      appendConfirmation(preview.reply, userText);
      return;
    }
    appendAssistant(preview.reply);
  };

  const applyChange = async (userText: string) => {
    const { reply } = await agent.mutateAsync({ user_text: userText });
    appendAssistant(reply);
  };

  const sendMessage = async (rawText: string) => {
    const text = rawText.trim();
    if (!text || busy) {
      return;
    }

    appendUser(text);
    setDraft("");

    try {
      const intent = classifyMessageIntent(text);

      if (intent === "question") {
        await answerQuestion(text);
        return;
      }

      if (mode === "ask") {
        await previewChange(text);
        return;
      }

      await applyChange(text);
    } catch {
      // Error surfaces via mutation state below.
    }
  };

  const confirmChange = async (message: ConfirmationMessage) => {
    resolveConfirmation(message.id, {
      id: message.id,
      kind: "assistant",
      content: "Applying changes…",
    });
    try {
      const { reply } = await agent.mutateAsync({ user_text: message.userText });
      resolveConfirmation(message.id, {
        id: message.id,
        kind: "assistant",
        content: reply,
      });
    } catch (caught) {
      const detail =
        caught instanceof Error ? caught.message : "Could not apply that change.";
      resolveConfirmation(message.id, {
        id: message.id,
        kind: "assistant",
        content: detail,
      });
    }
  };

  const cancelChange = (message: ConfirmationMessage) => {
    resolveConfirmation(message.id, {
      id: message.id,
      kind: "assistant",
      content: "Cancelled — no changes were applied to your design.",
    });
  };

  const runGoal = async (goal: SolverGoal) => {
    const label = GOAL_LABELS[goal];
    appendUser(label);
    try {
      if (mode === "ask") {
        await previewChange(label);
        return;
      }
      await optimise.mutateAsync(goal);
      appendAssistant(`Updated the design using “${label}”.`, "status");
    } catch {
      // Error surfaces via mutation state below.
    }
  };

  const placeholder =
    mode === "build"
      ? "Ask a question or describe a design change…"
      : "Ask about the design, or describe a change to preview…";

  return (
    <section
      className="flex h-full min-h-0 flex-col"
      aria-label="Design assistant chat"
    >
      <header className="mb-3 shrink-0">
        <h2 className="font-sans text-sm font-semibold text-ink">Design assistant</h2>
        <p className="mt-1 font-sans text-[12px] leading-4 text-tertiary">
          {mode === "build"
            ? "Questions stay read-only. Changes apply to the canvas."
            : "Changes preview first — you approve before they apply."}
        </p>
      </header>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto pr-1"
      >
        {messages.length === 0 ? (
          <EmptyState
            disabled={busy}
            onPrompt={(text) => void sendMessage(text)}
            onGoal={(goal) => void runGoal(goal)}
            onAuto={() => void runGoal("auto")}
          />
        ) : (
          <ul className="flex flex-col gap-3 pb-2" aria-label="Chat messages">
            {messages.map((message) => {
              if (message.kind === "user") {
                return (
                  <li key={message.id} className="flex justify-end">
                    <p className="max-w-[92%] rounded-[16px] rounded-br-[6px] bg-ink px-3.5 py-2.5 font-sans text-[13px] leading-5 text-paper">
                      {message.content}
                    </p>
                  </li>
                );
              }

              if (message.kind === "confirmation") {
                return (
                  <li key={message.id} className="flex justify-start">
                    <div className="max-w-[95%] rounded-[16px] border border-hairline bg-white px-3.5 py-3 font-sans text-[13px] leading-5 text-ink shadow-[0_1px_4px_rgba(26,23,18,0.04)]">
                      <p className="mb-2 font-sans text-[11px] font-semibold tracking-[1px] text-secondary uppercase">
                        Review change
                      </p>
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={agent.isPending}
                          onClick={() => confirmChange(message)}
                          className="rounded-pill bg-ink px-3.5 py-1.5 font-sans text-[12px] font-semibold text-paper disabled:opacity-45"
                        >
                          Apply
                        </button>
                        <button
                          type="button"
                          disabled={agent.isPending}
                          onClick={() => cancelChange(message)}
                          className="rounded-pill border border-hairline px-3.5 py-1.5 font-sans text-[12px] text-secondary hover:text-ink disabled:opacity-45"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </li>
                );
              }

              return (
                <li key={message.id} className="flex justify-start">
                  {message.tone === "status" ? (
                    <p className="max-w-[95%] rounded-[12px] bg-[#f3efe6] px-3 py-2 font-sans text-[12px] leading-5 text-secondary">
                      {message.content}
                    </p>
                  ) : (
                    <div className="max-w-[95%] rounded-[16px] rounded-bl-[6px] border border-[#e8e2d6] bg-[#faf7f0] px-3.5 py-2.5 font-sans text-[13px] leading-5 text-ink shadow-[0_1px_3px_rgba(26,23,18,0.04)]">
                      <span className="mb-1 block font-sans text-[10px] font-semibold tracking-[0.8px] text-secondary uppercase">
                        Assistant
                      </span>
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  )}
                </li>
              );
            })}
            {busy ? (
              <li className="flex justify-start">
                <p className="rounded-[12px] bg-[#f3efe6] px-3 py-2 font-sans text-[12px] text-secondary">
                  Thinking…
                </p>
              </li>
            ) : null}
          </ul>
        )}
      </div>

      <div className="mt-3 shrink-0">
        <form
          className="rounded-[18px] border border-hairline bg-white p-3 shadow-[0_8px_24px_rgba(26,23,18,0.06)]"
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage(draft);
          }}
        >
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendMessage(draft);
              }
            }}
            rows={3}
            placeholder={placeholder}
            aria-label="Design assistant message"
            disabled={busy}
            className="max-h-32 min-h-[4.5rem] w-full resize-none bg-transparent font-sans text-[13px] leading-5 text-ink outline-none placeholder:text-tertiary"
          />

          <div className="mt-2 flex items-center justify-between gap-2 border-t border-hairline pt-2">
            <ModeToggle value={mode} onChange={setMode} disabled={busy} />

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => void runGoal("auto")}
                aria-label={GOAL_LABELS.auto}
                title={GOAL_LABELS.auto}
                className="flex size-8 items-center justify-center rounded-pill text-[#7a5c00] transition-colors hover:bg-[#fff4cc] disabled:opacity-45"
              >
                <SparkIcon />
              </button>
              <button
                type="submit"
                disabled={busy || !draft.trim()}
                aria-label="Send message"
                className="flex size-8 items-center justify-center rounded-pill bg-ink text-paper disabled:opacity-45"
              >
                <SendIcon />
              </button>
            </div>
          </div>
        </form>

        {error ? (
          <p className="mt-2 font-sans text-[12px] text-ember" role="alert">
            {error.message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
