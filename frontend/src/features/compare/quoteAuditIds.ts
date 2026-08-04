// Defines stable ids for uploaded quote audits in compare and canvas views.
import type { QuoteAuditResponse } from "../../shared/api/types";

export function quoteAuditId(result: QuoteAuditResponse, index: number): string {
  return `quote:${index}:${result.filename}`;
}

export function quoteAuditLabel(result: QuoteAuditResponse, index: number): string {
  if (result.filename) {
    return result.filename;
  }
  return `Quote ${index + 1}`;
}

export function isQuoteAuditId(id: string): boolean {
  return id.startsWith("quote:");
}

export function parseQuoteAuditId(
  id: string,
  results: QuoteAuditResponse[],
): QuoteAuditResponse | null {
  if (!isQuoteAuditId(id)) {
    return null;
  }
  const index = results.findIndex((result, candidateIndex) =>
    id === quoteAuditId(result, candidateIndex),
  );
  return index >= 0 ? (results[index] ?? null) : null;
}
