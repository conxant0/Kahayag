import { Button } from "../../../shared/components/ui";
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
  const hasSearchError =
    statusMessage &&
    (googleStatus === "failed" ||
      googleStatus === "missing-key" ||
      statusMessage.includes("unavailable") ||
      statusMessage.includes("Unable"));

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
            onClick={() => setIsSelectingPropertyFromMap((current) => !current)}
            className="self-start font-sans text-sm font-semibold text-cobalt transition-colors duration-150 hover:underline"
          >
            {isSelectingPropertyFromMap
              ? "Cancel map selection"
              : "Select from map"}
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

      {suggestions.length > 0 && (
        <div
          id="address-suggestions"
          role="listbox"
          className="max-h-64 overflow-y-auto"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.placeId ?? `${suggestion.address}-${index}`}
              type="button"
              role="option"
              onClick={() => handleSuggestionSelect(suggestion)}
              className="mb-2 block w-full rounded-lg border border-hairline bg-white p-3 text-left transition-colors hover:bg-paper"
            >
              <span className="block font-sans text-sm font-semibold text-ink">
                {suggestion.primary}
              </span>
              {suggestion.secondary && (
                <span className="mt-1 block font-sans text-sm text-secondary">
                  {suggestion.secondary}
                </span>
              )}
            </button>
          ))}
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
