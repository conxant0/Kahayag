import { FlowLayout } from "../../shared/components/layout/FlowLayout";
import { MapSurface } from "../../shared/components/ui";
import { ROUTE_PATHS } from "../../app/routePaths";
import { PropertyAddressSearch } from "./components/PropertyAddressSearch";
import { PropertyMapPane } from "./components/PropertyMapPane";
import { usePropertyAddressSearch } from "./hooks/usePropertyAddressSearch";

/**
 * /locate — Figma 2170:30 (desktop) and 2132:19 (mobile).
 *
 * Rail: address search and map-selection shortcuts. The pane shows the selected
 * property on a satellite map once an address is chosen.
 */
export function PropertyPage() {
  const search = usePropertyAddressSearch();

  return (
    <FlowLayout
      step="Step 1 of 4"
      title="Where is your roof?"
      backHref={ROUTE_PATHS.landing}
      backLabel="Back to home"
      nextHref={ROUTE_PATHS.trace}
      nextLabel="Next: Trace your roof"
      nextDisabled={!search.selectedProperty}
      pane={
        <MapSurface className="relative min-h-72 lg:min-h-0">
          <PropertyMapPane
            selectedProperty={search.selectedProperty}
            googleStatus={search.googleStatus}
            isSelectingPropertyFromMap={search.isSelectingPropertyFromMap}
            onMapSelect={search.handleMapSelect}
          />
        </MapSurface>
      }
      lead={<PropertyAddressSearch {...search} />}
    />
  );
}
