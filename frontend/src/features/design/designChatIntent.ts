// Classifies chat input as a grounded question or a design change request.
const QUESTION_START =
  /^\s*(why|how|what|when|where|who|which|can you explain|tell me|explain|is it|are there|do i|does this)\b/i;
const CHANGE_VERB =
  /\b(add|remove|swap|change|update|optimi[sz]e|increase|decrease|make it|make this|more|fewer|less|extra|drop|include|maximi[sz]e|ensure)\b/i;
const CHANGE_NOUN =
  /\b(panel|panels|battery|batteries|inverter|budget|backup|independence|storage|blackout|kwp|system)\b/i;

export type DesignChatIntent = "question" | "change";

export function classifyMessageIntent(text: string): DesignChatIntent {
  const trimmed = text.trim();
  if (!trimmed) {
    return "question";
  }

  const endsWithQuestion = trimmed.endsWith("?");
  const startsAsQuestion = QUESTION_START.test(trimmed);
  const hasChangeCue = CHANGE_VERB.test(trimmed) || CHANGE_NOUN.test(trimmed);

  if ((endsWithQuestion || startsAsQuestion) && !CHANGE_VERB.test(trimmed)) {
    return "question";
  }

  if (hasChangeCue) {
    if ((endsWithQuestion || startsAsQuestion) && !CHANGE_VERB.test(trimmed)) {
      return "question";
    }
    return "change";
  }

  return "question";
}
