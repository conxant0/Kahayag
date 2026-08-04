// Defines provider-neutral frontend HTTP client configuration.
import { API_BASE_URL } from "../config/env";

/** Used when the response carries no `Content-Disposition` filename. */
const FALLBACK_REPORT_FILENAME = "kahayag-solar-report.pdf";

/**
 * A failure status, kept on the error so callers can branch on it.
 *
 * "The backend has no answer" (a 404) and "the backend could not answer" (a
 * 5xx, a timeout) call for different handling — one is an ordinary outcome,
 * the other may be worth retrying — and a bare message string cannot tell
 * them apart.
 */
export class ApiError extends Error {
  constructor(readonly status: number) {
    super(`Request failed: ${status}`);
  }
}

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

/**
 * Sends the JSON body and raises the backend's own message on failure.
 *
 * Both POST helpers go through here so a 422 reads the same whether the caller
 * wanted JSON or a file back — the error shape is the API's, not the caller's.
 */
async function postJson(path: string, body: unknown): Promise<Response> {
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
  return response;
}

export async function apiGet<T>(
  path: string,
  // Typeahead requests are abandoned as the query changes; the caller passes the
  // signal it will abort with.
  options: { signal?: AbortSignal } = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    signal: options.signal,
  });
  if (!response.ok) {
    throw new ApiError(response.status);
  }
  return response.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await postJson(path, body);
  return response.json() as Promise<T>;
}

/** Posts JSON and reads a file back, keeping the server's chosen filename. */
export async function apiPostBlob(
  path: string,
  body: unknown,
): Promise<{ blob: Blob; filename: string }> {
  const response = await postJson(path, body);
  const filename =
    response.headers
      .get("Content-Disposition")
      ?.match(/filename="?([^";]+)"?/)?.[1] ?? FALLBACK_REPORT_FILENAME;
  return { blob: await response.blob(), filename };
}

export async function apiUploadForm<T>(path: string, formData: FormData): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      detail?: unknown;
    } | null;
    throw new Error(formatErrorDetail(payload?.detail, response.status));
  }
  return response.json() as Promise<T>;
}
