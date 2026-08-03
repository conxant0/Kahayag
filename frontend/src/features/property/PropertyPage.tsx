import { ROUTE_PATHS } from "../../app/routePaths";
import { FlowLayout } from "../../shared/components/layout/FlowLayout";
import { MapSurface } from "../../shared/components/ui";

import { LocationPermissionDialog } from "./components/LocationPermissionDialog";
import { PropertyAddressSearch } from "./components/PropertyAddressSearch";
import { PropertyMapPane } from "./components/PropertyMapPane";
import { PropertySelectionSummary } from "./components/PropertySelectionSummary";
import { usePropertyAddressSearch } from "./hooks/usePropertyAddressSearch";

/**
 * /locate — Figma 2170:30 (desktop) and 2132:19 (mobile).
 *
 * Search an address, drop a pin, or use the browser's location, then confirm
 * the property. The pane shows it on a satellite map.
 *
 * Each child is handed the fields it uses rather than the whole hook, so the
 * hook can grow without quietly widening what any of them can reach into.
 */
export function PropertyPage() {
  const search = usePropertyAddressSearch();

  // A map that will not load is a note, not a failure: search still works and
  // the step still completes. Only a broken search reads as an error.
  const hasSearchError =
    search.statusMessage?.startsWith("Address search is unavailable") ?? false;

  return (
    <FlowLayout
      step="Step 1 of 4"
      title="Where is your roof?"
      backHref={ROUTE_PATHS.landing}
      backLabel="Back to home"
      nextHref={ROUTE_PATHS.trace}
      // The PRD names this step's primary action "Confirm Property". The pin is
      // a claim about which roof is being assessed, so confirming it is the
      // decision being made here, not merely moving on to the next screen.
      nextLabel="Confirm Property"
      nextDisabled={!search.selectedProperty}
      mobilePaneBehind
      pane={
        <MapSurface className="relative min-h-0 rounded-none border-0 lg:rounded-none lg:border">
          <PropertyMapPane
            selectedProperty={
              search.selectedProperty
                ? {
                    position: {
                      latitude: search.selectedProperty.latitude,
                      longitude: search.selectedProperty.longitude,
                    },
                    address: search.selectedProperty.address,
                  }
                : null
            }
            mapStatus={search.mapStatus}
            onMapSelect={search.handleMapSelect}
          />
        </MapSurface>
      }
      lead={
        <PropertyAddressSearch
          query={search.query}
          suggestions={search.suggestions}
          statusMessage={search.statusMessage}
          hasSearchError={hasSearchError}
          locationMessage={search.locationMessage}
          locationTone={search.locationTone}
          handleQueryChange={search.handleQueryChange}
          handleSuggestionSelect={search.handleSuggestionSelect}
        />
      }
    >
      <PropertySelectionSummary
        mapStatus={search.mapStatus}
        selectedProperty={search.selectedProperty}
        manualLatitude={search.manualLatitude}
        manualLongitude={search.manualLongitude}
        manualCoordinateMessage={search.manualCoordinateMessage}
        isLocating={search.isLocating}
        setManualLatitude={search.setManualLatitude}
        setManualLongitude={search.setManualLongitude}
        handleUseDemoProperty={search.handleUseDemoProperty}
        handleManualCoordinateSelection={search.handleManualCoordinateSelection}
        requestCurrentLocation={search.requestCurrentLocation}
      />

      <LocationPermissionDialog
        open={search.isLocationPromptOpen}
        onAllow={search.allowLocation}
        onDismiss={search.dismissLocationPrompt}
      />
    </FlowLayout>
  );
}
