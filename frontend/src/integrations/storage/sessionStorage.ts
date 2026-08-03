// Defines a failure-tolerant JSON wrapper around the browser's sessionStorage.

/**
 * Storage is unavailable more often than it looks: Safari in private browsing
 * throws on write, enterprise policy can disable it outright, and a full quota
 * throws on an otherwise valid `setItem`. Even reading `window.sessionStorage`
 * can throw, which is why the access itself is guarded.
 *
 * None of that should interrupt an assessment someone is halfway through, so
 * every operation here degrades to "nothing stored" and the app carries on in
 * memory. Persistence is a convenience; it is never the source of truth.
 */
function openStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Returns the parsed value, or `null` when there is nothing stored, storage is
 * unavailable, or the stored text is not valid JSON.
 *
 * Corrupt JSON is treated as absent rather than raised. A half-written key from
 * an earlier visit should not be able to break this one, and the caller has to
 * validate the shape anyway — stored text is untrusted input.
 */
export function readJson(key: string): unknown {
  const storage = openStorage();
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  const storage = openStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exhausted or writes refused. Dropping the write is correct: the
    // in-memory state is already updated and remains authoritative.
  }
}

export function removeJson(key: string): void {
  const storage = openStorage();
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(key);
  } catch {
    // Nothing to recover from — a key that cannot be removed is also a key that
    // could not have been written.
  }
}
