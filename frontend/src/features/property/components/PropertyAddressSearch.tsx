import { Button, PinIcon } from "../../../shared/components/ui";
import { cn } from "../../../shared/lib/cn";
import type { usePropertyAddressSearch } from "../hooks/usePropertyAddressSearch";

type PropertyAddressSearchProps = ReturnType<typeof usePropertyAddressSearch>;

export function PropertyAddressSearch({
  googleStatus,
  query,
  suggestions,
  selectedProperty,
  manualLatitude,
  manualLongitude,
  manualCoordinateMessage,
  isSelectingPropertyFromMap,
  isLocating,
  locationMessage,
  statusMessage,
  setManualLatitude,
  setManualLongitude,
  setIsSelectingPropertyFromMap,
  handleQueryChange,
  handleSuggestionSelect,
  handleUseDemoProperty,
  handleManualCoordinateSelection,
  requestCurrentLocation,
}: PropertyAddressSearchProps) {
  // A map that will not load is a note, not a failure: search still works and
  // the whole screen still completes. Only a broken search reads as an error.
  const hasSearchError =
    statusMessage?.startsWith("Address search is unavailable") ?? false;

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        fullWidth
        disabled={isLocating}
        onClick={requestCurrentLocation}
      >
        {isLocating ? "Finding your location…" : "Use my current location"}
      </Button>

      {locationMessage && (
        <p
          className={`font-sans text-sm ${
            locationMessage.includes("denied") ||
            locationMessage.includes("Unable") ||
            locationMessage.includes("Couldn't") ||
            locationMessage.includes("timed out")
              ? "text-crimson"
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
          className={`font-sans text-sm ${hasSearchError ? "text-crimson" : "text-secondary"}`}
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

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleUseDemoProperty}
          className="self-start font-sans text-sm font-semibold text-cobalt transition-colors duration-150 hover:underline"
        >
          Use demo property
        </button>
        {googleStatus === "ready" && (
          <button
            type="button"
            aria-pressed={isSelectingPropertyFromMap}
            onClick={() => setIsSelectingPropertyFromMap((current) => !current)}
            className={cn(
              "inline-flex items-center gap-1.5 self-start rounded-pill border px-3 py-1.5",
              "font-sans text-sm font-semibold transition-colors duration-150",
              isSelectingPropertyFromMap
                ? "border-cobalt bg-cobalt text-paper"
                : "border-cobalt/35 bg-cobalt-wash text-cobalt hover:border-cobalt",
            )}
          >
            <PinIcon size={14} />
            {isSelectingPropertyFromMap
              ? "Placing pin. Tap the map"
              : "Drop a pin on the map"}
          </button>
        )}
      </div>

      {googleStatus !== "ready" && (
        <div className="grid gap-2 rounded-lg border border-hairline bg-white p-4">
          <p className="font-sans text-sm font-semibold text-ink">
            Manual coordinate fallback
          </p>
          <input
            value={manualLatitude}
            onChange={(event) => setManualLatitude(event.target.value)}
            placeholder="Latitude"
            className="h-12 w-full rounded-pill border border-hairline bg-white px-4 font-sans text-sm text-ink"
          />
          <input
            value={manualLongitude}
            onChange={(event) => setManualLongitude(event.target.value)}
            placeholder="Longitude"
            className="h-12 w-full rounded-pill border border-hairline bg-white px-4 font-sans text-sm text-ink"
          />
          <button
            type="button"
            onClick={handleManualCoordinateSelection}
            className="self-start font-sans text-sm font-semibold text-cobalt transition-colors duration-150 hover:underline"
          >
            Use entered coordinates
          </button>
          {manualCoordinateMessage && (
            <p className="text-crimson font-sans text-sm">
              {manualCoordinateMessage}
            </p>
          )}
        </div>
      )}

      {selectedProperty && (
        <div className="font-sans text-sm text-secondary">
          <p className="font-semibold text-ink">
            {selectedProperty.name || selectedProperty.address}
          </p>
          {selectedProperty.name && <p>{selectedProperty.address}</p>}
          <p className="mt-1">
            {selectedProperty.latitude.toFixed(6)},{" "}
            {selectedProperty.longitude.toFixed(6)}
          </p>
        </div>
      )}
    </>
  );
}
