// Defines address search, served by our own backend.
//
// The browser does not talk to a geocoder directly. The developer guide is
// explicit about why: the backend holds the provider behind a replaceable
// adapter, enforces the one-request-per-second limit centrally instead of
// trusting every visitor's browser to behave, and sets the `User-Agent` the
// usage policy asks for, which a browser cannot send at all.
//
// So this file knows about our API and nothing about who is drawing the
// answers underneath it.
import { apiGet } from "../../shared/api/client";
import { ENDPOINTS } from "../../shared/api/endpoints";

export const MIN_QUERY_LENGTH = 3;
export const SUGGESTION_LIMIT = 7;

/**
 * How precisely a result names a place.
 *
 * A geocoder will answer a vague query with a municipality or a province.
 * Those are real answers, but they point at a centroid rather than a roof, so
 * the screen has to be able to say so instead of dropping a pin in the middle
 * of a town and calling it a house.
 */
export type MatchPrecision = "exact" | "approximate";

export type AddressSuggestion = {
  /** The provider's identifier, when the backend passes one through. */
  placeId: string | null;
  /** The bold first line: a house, a street, a landmark. */
  primary: string;
  /** The rest of the address, shown under the primary line. */
  secondary: string;
  /** The full single-line address. */
  address: string;
  latitude: number;
  longitude: number;
  /** Whether this names a building or merely the area around one. */
  precision: MatchPrecision;
};

/**
 * What `GET /properties/search` returns.
 *
 * `placeId` and `precision` are optional because the endpoint does not send
 * them yet. Until it does, every result reads as approximate, which errs
 * toward telling someone to check the pin rather than toward false confidence.
 */
type PropertySearchResult = {
  address?: string;
  latitude?: number;
  longitude?: number;
  placeId?: string | null;
  precision?: MatchPrecision | null;
};

/**
 * Splits a single-line address into a bold head and the rest.
 *
 * The backend returns one comma-joined string. The first segment is the most
 * specific part, which is what a person scans for, so it becomes the primary
 * line and everything after it the secondary.
 */
function splitAddress(address: string) {
  const segments = address.split(",").map((part) => part.trim());
  return {
    primary: segments[0] || address,
    secondary: segments.slice(1).join(", "),
  };
}

function toSuggestion(result: PropertySearchResult): AddressSuggestion | null {
  const address = result.address?.trim();
  const { latitude, longitude } = result;

  // A result without usable coordinates cannot be selected, so it is dropped
  // rather than offered and then failing when it is picked.
  if (
    !address ||
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  const { primary, secondary } = splitAddress(address);

  return {
    placeId: result.placeId ?? null,
    primary,
    secondary,
    address,
    latitude,
    longitude,
    precision: result.precision ?? "approximate",
  };
}

/** Searches for addresses matching `query`. Returns [] when nothing matches. */
export async function searchAddresses(
  query: string,
  options: { limit?: number; signal?: AbortSignal } = {},
): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) {
    return [];
  }

  const params = new URLSearchParams({
    query: trimmed,
    limit: String(options.limit ?? SUGGESTION_LIMIT),
  });

  const payload = await apiGet<unknown>(
    `${ENDPOINTS.propertySearch}?${params.toString()}`,
    { signal: options.signal },
  );

  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((result) => toSuggestion(result as PropertySearchResult))
    .filter(
      (suggestion): suggestion is AddressSuggestion => suggestion !== null,
    );
}
