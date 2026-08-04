// Defines copy and follow-up prompts for the permits chat sidebar. Every
// string the assistant speaks still comes from POST /permits/chat — this
// module only shapes the homeowner-facing shell around that endpoint.

export const PERMIT_CHAT_SUGGESTED_QUESTIONS = [
  "Do I need a notarized authorization?",
  "What track am I on?",
  "I'm not the registered owner — what changes?",
] as const;

export const PERMIT_CHAT_FOLLOW_UP_QUESTIONS = [
  "Why is the barangay clearance required?",
  "What documents am I still missing?",
  "Is my packet complete?",
] as const;

export function permitChatWelcomeCopy(): string {
  return (
    "Ask why a document is required, or tell us something that changes " +
    "your answers — replies come from the same rules that computed this " +
    "checklist."
  );
}
