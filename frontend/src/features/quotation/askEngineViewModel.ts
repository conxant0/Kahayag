// Derives welcome copy, suggested prompts, and explain payloads for Ask the engine.
import type { DesignBuild, QuoteAuditResponse } from "../../shared/api/types";
import { peso } from "../../shared/lib/currency";
import { classifyMessageIntent } from "../design/designChatIntent";
import { ASK_AI_CHIPS } from "../design/designViewModel";

export type AskEngineMode = "build" | "quote";

export type ChatTurn = {
  role: "user" | "assistant";
  text: string;
};

export const MAX_ASK_ENGINE_TURNS = 12;

export function appendAskEngineTurn(
  current: readonly ChatTurn[],
  turn: ChatTurn,
): readonly ChatTurn[] {
  return [...current, turn].slice(-MAX_ASK_ENGINE_TURNS);
}

function batteryLabel(build: DesignBuild): string {
  if (build.battery_kwh && build.battery_kwh > 0) {
    return `${build.battery_kwh.toFixed(1)} kWh storage`;
  }
  return "no battery (grid-tie)";
}

function paybackLabel(build: DesignBuild): string {
  return build.payback_years
    ? `about ${build.payback_years.toFixed(1)} years payback`
    : "payback outside the modelled horizon";
}

export function askEngineWelcomeCopy(params: {
  mode: AskEngineMode;
  build: DesignBuild | null;
  quote: QuoteAuditResponse | null;
}): string {
  const { mode, build, quote } = params;

  if (mode === "quote" && quote) {
    const quotedTotal =
      typeof quote.extracted_total_php === "number"
        ? peso(quote.extracted_total_php)
        : "an unspecified total";
    const systemSize =
      typeof quote.extracted_system_kwp === "number"
        ? `${quote.extracted_system_kwp.toFixed(1)} kW`
        : "a quoted system size";
    const delta =
      typeof quote.extracted_total_php === "number"
        ? quote.extracted_total_php - quote.benchmark_total_php
        : null;
    const deltaCopy =
      delta === null
        ? ""
        : delta === 0
          ? " It lines up with our benchmark."
          : delta > 0
            ? ` That is ${peso(delta)} above our ${peso(quote.benchmark_total_php)} estimate.`
            : ` That is ${peso(Math.abs(delta))} below our ${peso(quote.benchmark_total_php)} estimate.`;

    return `I can walk through this uploaded installer quote. It totals ${quotedTotal} for ${systemSize}.${deltaCopy} Ask about the price gap, missing line items, or how it compares to the AI design on your roof.`;
  }

  if (build) {
    return `I can walk through any part of this design. Right now it's ${build.system_kwp.toFixed(2)} kWp (${build.panel_count} panels) with ${batteryLabel(build)} and ${paybackLabel(build)}. Ask why a specific panel or inverter was chosen, what happens at night, or how to add backup storage.`;
  }

  return "Ask about your design, savings, or equipment choices. Answers stay grounded on solver facts — never invented figures.";
}

export function askEngineTopChips(params: {
  mode: AskEngineMode;
}): readonly string[] {
  if (params.mode === "quote") {
    return [
      "Why is this quote higher than your estimate?",
      "What's missing from this quote?",
      "What should I ask the installer?",
    ] as const;
  }

  return [
    ASK_AI_CHIPS[0]!,
    ASK_AI_CHIPS[2]!,
  ] as const;
}

export function askEngineFollowUpQuestions(params: {
  mode: AskEngineMode;
}): readonly string[] {
  if (params.mode === "quote") {
    return [
      "Are these parts compatible with my roof?",
      "Is installation included in this price?",
      "Can I negotiate using your benchmark?",
    ] as const;
  }

  return [
    "What if VECO rates rise 5%?",
    "Can I drop the battery later?",
    "How does fit score work?",
  ] as const;
}

export function askEngineChangeRedirectCopy(): string {
  return "Design changes happen on the Design page — this quotation is a frozen snapshot. Go back to Design to swap equipment, add backup, or re-run the solver, then return here for an updated quote.";
}

export function isQuotationChangeRequest(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }

  if (/^\s*(can i|could i|would i|is it possible|what if|what happens if)\b/i.test(trimmed)) {
    return false;
  }

  return classifyMessageIntent(trimmed) === "change";
}

export function formatQuestionForExplain(
  question: string,
  params: {
    mode: AskEngineMode;
    quote: QuoteAuditResponse | null;
  },
): string {
  const { mode, quote } = params;
  if (mode !== "quote" || !quote) {
    return question;
  }

  const findings = quote.findings
    .map((finding) => `${finding.severity}: ${finding.message}`)
    .join("; ");
  const pros = quote.pros?.length ? quote.pros.join("; ") : null;
  const cons = quote.cons?.length ? quote.cons.join("; ") : null;
  const installerQuestions = quote.questions_for_installer?.length
    ? quote.questions_for_installer.join("; ")
    : null;

  return [
    "Context: The homeowner is reviewing an uploaded installer quote on the quotation page.",
    `Quote file: ${quote.filename}`,
    typeof quote.extracted_total_php === "number"
      ? `Quoted total: PHP ${quote.extracted_total_php}`
      : null,
    `Our benchmark total: PHP ${quote.benchmark_total_php}`,
    typeof quote.extracted_system_kwp === "number"
      ? `Quoted system: ${quote.extracted_system_kwp} kWp`
      : null,
    `Benchmark system: ${quote.benchmark_system_kwp} kWp`,
    quote.verdict ? `Audit verdict: ${quote.verdict}` : null,
    quote.summary.trim() ? `Audit summary: ${quote.summary.trim()}` : null,
    findings ? `Audit findings: ${findings}` : null,
    pros ? `Pros: ${pros}` : null,
    cons ? `Cons: ${cons}` : null,
    installerQuestions ? `Suggested installer questions: ${installerQuestions}` : null,
    `Question: ${question}`,
  ]
    .filter(Boolean)
    .join("\n");
}
