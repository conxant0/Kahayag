import { PinIcon } from "../../../shared/components/ui";
import type { usePropertyAddressSearch } from "../hooks/usePropertyAddressSearch";

type PropertyAddressSearchProps = ReturnType<typeof usePropertyAddressSearch>;

export function PropertyAddressSearch({
  query,
  suggestions,
  locationMessage,
  statusMessage,
  handleQueryChange,
  handleSuggestionSelect,
}: PropertyAddressSearchProps) {
  // A map that will not load is a note, not a failure: search still works and
  // the whole screen still completes. Only a broken search reads as an error.
  const hasSearchError =
    statusMessage?.startsWith("Address search is unavailable") ?? false;

  return (
    <>
      {locationMessage && (
        <p
          className={`font-sans text-sm ${
            locationMessage.includes("denied") ||
            locationMessage.includes("Unable") ||
            locationMessage.includes("Couldn't") ||
            locationMessage.includes("timed out")
              ? "text-ember"
              : "text-secondary"
          }`}
        >
          {locationMessage}
        </p>
      )}

      <label className="sr-only" htmlFor="address">
        Search an address
      </label>
      <input
        id="address"
        type="search"
        value={query}
        onChange={(event) => handleQueryChange(event.target.value)}
        placeholder="Search an address…"
        className="h-14 w-full rounded-pill border border-hairline bg-white px-5 font-sans text-[15px] text-ink placeholder:text-tertiary-ink"
        aria-autocomplete="list"
        aria-controls="address-suggestions"
        aria-expanded={suggestions.length > 0}
      />

      {statusMessage && (
        <p
          className={`font-sans text-sm ${hasSearchError ? "text-ember" : "text-secondary"}`}
        >
          {statusMessage}
        </p>
      )}

      {suggestions.length > 0 && (
        // One card carrying hairline-separated rows, so the list reads as the
        // field's own drawer rather than a stack of loose tiles. Same border,
        // fill and horizontal rhythm as the input above it.
        <div
          id="address-suggestions"
          role="listbox"
          className="max-h-72 overflow-x-hidden overflow-y-auto rounded-card border border-hairline bg-white"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.placeId ?? `${suggestion.address}-${index}`}
              type="button"
              role="option"
              onClick={() => handleSuggestionSelect(suggestion)}
              className="flex w-full items-start gap-3 border-t border-hairline px-5 py-3.5 text-left transition-colors duration-150 first:border-t-0 hover:bg-paper"
            >
              <span className="mt-0.5 shrink-0 text-tertiary-ink">
                <PinIcon size={14} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-sans text-[15px] font-semibold text-ink">
                  {suggestion.primary}
                </span>
                {suggestion.secondary && (
                  <span className="mt-0.5 block truncate font-sans text-sm text-secondary">
                    {suggestion.secondary}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
