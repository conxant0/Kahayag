// Defines the Nominatim-backed address search and reverse geocoding adapter.
//
// Nominatim shapes stop here: callers get plain `AddressSuggestion` values and
// never see `display_name`, `place_id`, or the string-typed `lat`/`lon` the API
// actually returns.
//
// Nominatim's usage policy caps a client at roughly one request per second and
// asks that autocomplete not hammer it, so the caller is expected to debounce.
// `MIN_QUERY_LENGTH` and `SUGGESTION_LIMIT` live here for the same reason: they
// are properties of the provider, not of the screen using it.

const DEFAULT_BASE_URL = "https://nominatim.openstreetmap.org";

/**
 * Points at the public instance unless overridden. Set this to the backend once
 * it proxies geocoding: the browser cannot send a `User-Agent`, which the usage
 * policy asks for, and a server-side proxy can also throttle across visitors
 * rather than trusting each one to behave.
 */
const BASE_URL = (
  import.meta.env.VITE_NOMINATIM_BASE_URL || DEFAULT_BASE_URL
).replace(/\/+$/, "");

export const MIN_QUERY_LENGTH = 3;
export const SUGGESTION_LIMIT = 7;

export type AddressSuggestion = {
  /** Nominatim's own identifier, kept so a pick can be traced back. */
  placeId: string | null;
  /** The bold first line: a house, a street, a landmark. */
  primary: string;
  /** The rest of the address, shown under the primary line. */
  secondary: string;
  /** The full single-line address. */
  address: string;
  latitude: number;
  longitude: number;
};

type NominatimPlace = {
  place_id?: number | string;
  display_name?: string;
  name?: string;
  lat?: string;
  lon?: string;
};

function coordinate(value: string | undefined): number {
  return value === undefined ? Number.NaN : Number.parseFloat(value);
}

/**
 * Splits a `display_name` into a bold head and the rest.
 *
 * Nominatim returns one comma-joined string rather than structured lines. The
 * first segment is the most specific part, which is what a person scans for, so
 * it becomes the primary line and everything after it the secondary.
 */
function splitDisplayName(displayName: string, name?: string) {
  const segments = displayName.split(",").map((part) => part.trim());
  const primary = name?.trim() || segments[0] || displayName;
  const rest = segments[0] === primary ? segments.slice(1) : segments;

  return { primary, secondary: rest.join(", ") };
}

function toSuggestion(place: NominatimPlace): AddressSuggestion | null {
  const latitude = coordinate(place.lat);
  const longitude = coordinate(place.lon);
  const address = place.display_name?.trim();

  // A result without usable coordinates cannot be selected, so it is dropped
  // rather than offered and failing on click.
  if (!address || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const { primary, secondary } = splitDisplayName(address, place.name);

  return {
    placeId: place.place_id === undefined ? null : String(place.place_id),
    primary,
    secondary,
    address,
    latitude,
    longitude,
  };
}

/** Searches for addresses matching `query`. Returns [] when nothing matches. */
export async function searchAddresses(
  query: string,
  options: { signal?: AbortSignal; limit?: number } = {},
): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) {
    return [];
  }

  const url = new URL(`${BASE_URL}/search`);
  url.searchParams.set("q", trimmed);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", String(options.limit ?? SUGGESTION_LIMIT));

  const response = await fetch(url, {
    signal: options.signal,
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Address search failed with status ${response.status}`);
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((place) => toSuggestion(place as NominatimPlace))
    .filter(
      (suggestion): suggestion is AddressSuggestion => suggestion !== null,
    );
}

/**
 * Names the coordinates a person just dropped a pin on.
 *
 * Resolves to `null` rather than throwing when there is no answer: the caller
 * already has usable coordinates and only wanted a nicer label for them.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
  options: { signal?: AbortSignal } = {},
): Promise<string | null> {
  const url = new URL(`${BASE_URL}/reverse`);
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("format", "jsonv2");

  try {
    const response = await fetch(url, {
      signal: options.signal,
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as NominatimPlace;
    return payload.display_name?.trim() || null;
  } catch {
    return null;
  }
}
