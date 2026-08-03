import { Button, PinIcon } from "../../../shared/components/ui";
import { useMediaQuery } from "../../../shared/hooks/useMediaQuery";
import type { MapStatus } from "../../../integrations/maps";
import type { SelectedProperty } from "../../../state/assessmentStore";

/** Named rather than the hook's whole return, for the same reason as the search panel. */
type Props = {
  mapStatus: MapStatus;
  selectedProperty: SelectedProperty | null;
  manualLatitude: string;
  manualLongitude: string;
  manualCoordinateMessage: string;
  isLocating: boolean;
  setManualLatitude: (value: string) => void;
  setManualLongitude: (value: string) => void;
  handleUseDemoProperty: () => void;
  handleManualCoordinateSelection: () => void;
  requestCurrentLocation: () => void;
};

/**
 * The shortcuts and the confirmed pick.
 *
 * Kept out of the block above the map on purpose. On a phone this floats at
 * the foot of the pane, so the header stays down to a title and a search
 * field and the map gets the rest of the screen. On desktop it simply falls
 * under the rail, where there is room for both.
 */
export function PropertySelectionSummary({
  mapStatus,
  selectedProperty,
  manualLatitude,
  manualLongitude,
  manualCoordinateMessage,
  isLocating,
  setManualLatitude,
  setManualLongitude,
  handleUseDemoProperty,
  handleManualCoordinateSelection,
  requestCurrentLocation,
}: Props) {
  const isTouch = useMediaQuery("(hover: none)");

  /**
   * How the pin is set, named for the gesture this device actually has.
   *
   * It rides with the other floating controls rather than sitting inside the
   * pane: on mobile the pane starts behind the header band, so anything at the
   * top of it is covered by the very block that leaves no room to spare.
   */
  const hint = isTouch
    ? selectedProperty
      ? "Press and hold the map to move the pin"
      : "Press and hold the map to set your pin"
    : selectedProperty
      ? "Click the map to move the pin"
      : "Click the map to set your pin";

  return (
    <>
      {mapStatus === "ready" && (
        <p className="flex w-fit items-center gap-1.5 rounded-pill bg-ink-veil px-3 py-1.5 font-sans text-[12px] font-semibold text-paper backdrop-blur-sm lg:gap-2 lg:px-4 lg:py-2.5 lg:text-[14px]">
          <PinIcon size={13} />
          {hint}
        </p>
      )}

      {/* Both shortcuts on one line at ghost size. Full-width buttons stacked
       * above a map spend the screen the map needs. */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          disabled={isLocating}
          onClick={requestCurrentLocation}
          className="px-3 py-1.5 text-[12px] lg:px-5 lg:py-3.5 lg:text-[15px]"
        >
          {isLocating ? "Locating…" : "Use my location"}
        </Button>

        <Button
          variant="ghost"
          onClick={handleUseDemoProperty}
          className="px-3 py-1.5 text-[12px] lg:px-5 lg:py-3.5 lg:text-[15px]"
        >
          Demo property
        </Button>
      </div>

      {mapStatus !== "ready" && (
        <div className="grid gap-2 rounded-card border border-hairline bg-white p-4">
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
            <p className="font-sans text-sm text-ember">
              {manualCoordinateMessage}
            </p>
          )}
        </div>
      )}

      {selectedProperty && (
        // Carries its own paper on mobile, where it sits over the satellite
        // photo; on the wide layout the rail is already paper and the card
        // would be a box drawn around nothing.
        <div className="rounded-card border border-hairline bg-white/95 px-3 py-2 font-sans text-[13px] text-secondary backdrop-blur-sm lg:border-0 lg:bg-transparent lg:p-0 lg:text-sm lg:backdrop-blur-none">
          <p className="truncate font-semibold text-ink">
            {selectedProperty.address}
          </p>
          <p className="text-[11px] text-tertiary-ink lg:text-[13px]">
            {selectedProperty.latitude.toFixed(6)},{" "}
            {selectedProperty.longitude.toFixed(6)}
          </p>
        </div>
      )}
    </>
  );
}
