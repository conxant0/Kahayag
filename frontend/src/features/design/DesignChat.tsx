// Defines the unified Build / Ask design assistant chat panel.
//
// Shares its look with the quotation `AskEngineSidebar` and the permits
// `PermitChatSidebar`: engine-icon header, shared Chip starters, the homeowner's
// words in the neutral track fill, engine replies on the cobalt left rule, and
// a pill composer.
import { useEffect, useRef, useState } from "react";

import type { SolverGoal } from "../../shared/api/types";
import { Chip, Eyebrow } from "../../shared/components/ui";
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
  reasoningSteps?: Array<{
    kind: "thinking" | "tool_call" | "tool_result" | "error";
    label: string;
    detail?: string | null;
  }>;
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

function ReasoningStepsList({
  steps,
}: {
  steps: NonNullable<AssistantMessage["reasoningSteps"]>;
}) {
  if (steps.length === 0) {
    return null;
  }
  return (
    <ul className="mb-2 space-y-1" aria-label="Reasoning steps">
      {steps.map((step, index) => (
        <li
          key={`${step.kind}-${index}`}
          className={cn(
            "font-sans text-[12px] leading-4",
            step.kind === "error" ? "text-ember" : "text-tertiary-ink",
          )}
        >
          <span className="mr-1.5" aria-hidden="true">
            {step.kind === "error"
              ? "✕"
              : step.kind === "tool_result"
                ? "✓"
                : "◉"}
          </span>
          {step.label}
          {step.detail ? (
            <span className="block pl-4">{step.detail}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function EngineIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="4"
        y="7"
        width="16"
        height="12"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="9" cy="12" r="1.2" fill="currentColor" />
      <circle cx="15" cy="12" r="1.2" fill="currentColor" />
      <path
        d="M9 16h6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M10 7V5.5a2 2 0 0 1 4 0V7"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function SendIcon() {
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
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
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
    <div className="flex flex-col gap-5 pb-2">
      <div className="flex flex-wrap gap-2">
        {ASK_AI_CHIPS.map((chip) => (
          <Chip key={chip} onClick={() => onPrompt(chip)} disabled={disabled}>
            {chip}
          </Chip>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <Eyebrow>Quick actions</Eyebrow>
        <ul className="flex flex-col divide-y divide-hairline">
          {GOAL_SHORTCUTS.map((goal) => (
            <li key={goal}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onGoal(goal)}
                className="flex w-full items-center justify-between gap-3 py-2.5 text-left font-sans text-[13px] text-secondary transition-colors hover:text-ink disabled:opacity-45"
              >
                <span>{GOAL_LABELS[goal]}</span>
                <span aria-hidden="true" className="text-tertiary-ink">
                  ›
                </span>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              disabled={disabled}
              onClick={onAuto}
              className="flex w-full items-center gap-2 py-2.5 text-left font-sans text-[13px] font-semibold text-[#7a5c00] transition-colors hover:text-ink disabled:opacity-45"
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
    // The empty state reads top-down; only a transcript pins to the latest.
    if (node && messages.length > 0) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages, busy]);

  const appendUser = (content: string) => {
    setMessages((current) => [
      ...current,
      { id: nextMessageId(), kind: "user", content },
    ]);
  };

  const appendAssistant = (
    content: string,
    tone: "answer" | "status" = "answer",
    reasoningSteps?: AssistantMessage["reasoningSteps"],
  ) => {
    setMessages((current) => [
      ...current,
      { id: nextMessageId(), kind: "assistant", content, tone, reasoningSteps },
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
    const preview = await agent.mutateAsync({
      user_text: userText,
      dry_run: true,
    });
    if (preview.requires_confirmation) {
      appendConfirmation(preview.reply, userText);
      return;
    }
    appendAssistant(preview.reply, "answer", preview.reasoning_steps);
  };

  const applyChange = async (userText: string) => {
    const { reply, reasoning_steps: reasoningSteps } = await agent.mutateAsync({
      user_text: userText,
    });
    appendAssistant(reply, "answer", reasoningSteps);
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
      const { reply, reasoning_steps: reasoningSteps } =
        await agent.mutateAsync({
          user_text: message.userText,
        });
      resolveConfirmation(message.id, {
        id: message.id,
        kind: "assistant",
        content: reply,
        reasoningSteps,
      });
    } catch (caught) {
      const detail =
        caught instanceof Error
          ? caught.message
          : "Could not apply that change.";
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
    mode === "build" ? "Ask or describe a change…" : "Ask or preview a change…";

  return (
    <section
      className="flex h-full min-h-0 flex-col gap-4"
      aria-label="Design assistant chat"
    >
      <header className="shrink-0">
        <div className="flex items-center gap-2 text-ink">
          <EngineIcon />
          <h2 className="font-sans text-sm font-semibold">Design assistant</h2>
        </div>
        <p className="mt-2 font-sans text-[13px] leading-5 text-secondary">
          {mode === "build"
            ? "Questions stay read-only. Changes apply to the canvas."
            : "Changes preview first — you approve before they apply."}
        </p>
      </header>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto pr-0.5"
        aria-live="polite"
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
                    <p className="max-w-[92%] rounded-[14px] bg-[#f2eee4] px-3.5 py-2 font-sans text-sm leading-5 whitespace-pre-wrap text-ink">
                      {message.content}
                    </p>
                  </li>
                );
              }

              if (message.kind === "confirmation") {
                return (
                  <li key={message.id}>
                    <div className="rounded-[14px] border border-hairline bg-white p-3 font-sans text-sm leading-6 text-ink">
                      <Eyebrow tone="cobalt" className="mb-1.5">
                        Review change
                      </Eyebrow>
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {/* Disabled on any in-flight mutation, not just the
                            agent's — both requests would carry the same
                            pre-mutation session and the loser's change would
                            be silently overwritten. */}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void confirmChange(message)}
                          className="rounded-pill bg-ink px-4 py-2 font-sans text-[13px] font-semibold text-paper disabled:opacity-45"
                        >
                          Apply
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => cancelChange(message)}
                          className="rounded-pill border border-hairline bg-white px-4 py-2 font-sans text-[13px] font-medium text-secondary transition-colors hover:border-tertiary hover:text-ink disabled:opacity-45"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </li>
                );
              }

              return (
                <li
                  key={message.id}
                  className={cn(
                    "border-l-2 border-cobalt pl-3 font-sans text-sm leading-6",
                    message.tone === "status" ? "text-secondary" : "text-ink",
                  )}
                >
                  {message.reasoningSteps ? (
                    <ReasoningStepsList steps={message.reasoningSteps} />
                  ) : null}
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </li>
              );
            })}
            {busy ? (
              <li className="border-l-2 border-cobalt pl-3 font-sans text-sm leading-6 text-tertiary-ink">
                Thinking…
              </li>
            ) : null}
          </ul>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <ModeToggle value={mode} onChange={setMode} disabled={busy} />
          {/* The empty state already lists auto-optimise; offer it here only
              once the transcript has replaced that list. */}
          {messages.length > 0 ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void runGoal("auto")}
              aria-label={GOAL_LABELS.auto}
              title={GOAL_LABELS.auto}
              className="flex size-8 items-center justify-center rounded-pill bg-[#fff4cc] text-[#7a5c00] transition-colors hover:bg-[#ffeeb3] disabled:opacity-45"
            >
              <SparkIcon />
            </button>
          ) : null}
        </div>

        <form
          className="flex items-center gap-2 rounded-pill border border-hairline bg-white py-1.5 pr-1.5 pl-4"
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage(draft);
          }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={placeholder}
            aria-label="Design assistant message"
            disabled={busy}
            className="min-w-0 flex-1 bg-transparent font-sans text-sm text-ink outline-none placeholder:text-tertiary-ink"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            aria-label="Send message"
            className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-ink text-paper disabled:opacity-45"
          >
            <SendIcon />
          </button>
        </form>

        {error ? (
          <p className="font-sans text-sm text-ember" role="alert">
            {error.message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
