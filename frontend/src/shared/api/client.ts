// Defines provider-neutral frontend HTTP client configuration.
import { API_BASE_URL } from "../config/env";

// FastAPI's default validation-error handler shapes `detail` as an array of
// {loc, msg, type} objects rather than a string; join their messages instead
// of surfacing the raw array as JSON.
export function formatErrorDetail(detail: unknown, status: number) {
  if (typeof detail === "string") {
    return detail;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item) =>
        typeof item === "object" && item !== null && "msg" in item
          ? String((item as { msg: unknown }).msg)
          : JSON.stringify(item),
      )
      .join("; ");
  }
  if (detail) {
    return JSON.stringify(detail);
  }
  return `Request failed: ${status}`;
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      detail?: unknown;
    } | null;
    throw new Error(formatErrorDetail(payload?.detail, response.status));
  }
  return response.json() as Promise<T>;
}

const DEFAULT_PDF_FILENAME = "kahayag-solar-report.pdf";

function filenameFromContentDisposition(header: string | null): string {
  const match = header?.match(/filename="?([^";]+)"?/);
  return match?.[1] ?? DEFAULT_PDF_FILENAME;
}

export async function apiPostBlob(
  path: string,
  body: unknown,
): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      detail?: unknown;
    } | null;
    throw new Error(formatErrorDetail(payload?.detail, response.status));
  }
  const filename = filenameFromContentDisposition(
    response.headers.get("Content-Disposition"),
  );
  return { blob: await response.blob(), filename };
}
