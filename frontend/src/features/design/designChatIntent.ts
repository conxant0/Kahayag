// Classifies chat input as a grounded question or a design change request.
const QUESTION_START =
  /^\s*(why|how|what|when|where|who|which|would|could|can|is it|are there|do i|does this|can you explain|tell me|explain)\b/i;
const GENERAL_QUESTION =
  /\b(work without|without a battery|without battery|without storage|without an energy storage|need a battery|need battery|do i need|can solar|will the system work|will it work|how about at night|what about at night|at night|what got rejected|what was rejected|why not|why didn't|why didnt)\b/i;
const CHANGE_VERB =
  /\b(add|remove|swap|change|update|optimi[sz]e|increase|decrease|make it|make this|more|fewer|less|extra|drop|include|maximi[sz]e|ensure|upgrade|downgrade|switch|use|try|set|generate|create|get me|give me|show me a)\b/i;
const CHANGE_NOUN =
  /\b(panel|panels|battery|batteries|inverter|budget|backup|independence|storage|blackout|brownout|kwp|system|quotation|quote|bom)\b/i;
const QUOTATION_REQUEST =
  /\b(quotation|quote|price breakdown|line item|bom|bill of materials)\b/i;
const AGENT_DIAGNOSTIC =
  /\b(reject|rejected|failed|catalog|compatible|list panels|list inverters|list batteries)\b/i;

export type DesignChatIntent = "question" | "change";

export function classifyMessageIntent(text: string): DesignChatIntent {
  const trimmed = text.trim();
  if (!trimmed) {
    return "question";
  }

  const endsWithQuestion = trimmed.endsWith("?");
  const startsAsQuestion = QUESTION_START.test(trimmed);
  const generalQuestion = GENERAL_QUESTION.test(trimmed);
  const quotationRequest = QUOTATION_REQUEST.test(trimmed);
  const agentDiagnostic = AGENT_DIAGNOSTIC.test(trimmed);
  const hasChangeCue = CHANGE_VERB.test(trimmed) || CHANGE_NOUN.test(trimmed);

  if (quotationRequest && CHANGE_VERB.test(trimmed)) {
    return "change";
  }

  if (agentDiagnostic && !startsAsQuestion && !endsWithQuestion) {
    return "change";
  }

  if (generalQuestion || ((endsWithQuestion || startsAsQuestion) && !CHANGE_VERB.test(trimmed))) {
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
