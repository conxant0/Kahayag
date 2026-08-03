import { resolveApproximateLocationFromBackend } from "../../../integrations/geolocationFallback";

const GEOLOCATION_ATTEMPTS: PositionOptions[] = [
  // Network/WiFi positioning works on most laptops without GPS.
  { enableHighAccuracy: false, timeout: 30000, maximumAge: 300000 },
  // Retry with GPS when available (phones, tablets).
  { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 },
];

/**
 * Where a position came from.
 *
 * Closed, because the screen words an approximate pin differently to one the
 * device reported, and a free string makes that easy to get wrong.
 */
export type PositionSource = "browser" | "google-ip" | "ip-approximate";

export type ResolvedPosition = {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
  };
  source: PositionSource;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getCurrentPosition(
  options: PositionOptions,
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

export function getGeolocationErrorMessage(error: unknown): string {
  if (
    isRecord(error) &&
    typeof error.message === "string" &&
    error.message.length > 0
  ) {
    return error.message;
  }

  switch (isRecord(error) ? error.code : undefined) {
    case 1:
      return "Location access was denied. Search an address or pick a spot on the map instead.";
    case 2:
      return "Couldn't determine your location. Search your address below or tap Select from map.";
    case 3:
      return "Location lookup timed out. Try again or search an address.";
    default:
      return "Unable to access your location. Search an address or pick from the map instead.";
  }
}

export async function resolveCurrentPosition(): Promise<ResolvedPosition> {
  let lastError: unknown = null;

  if (navigator.geolocation) {
    for (const options of GEOLOCATION_ATTEMPTS) {
      try {
        const position = await getCurrentPosition(options);
        return {
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy ?? null,
          },
          source: "browser",
        };
      } catch (error) {
        lastError = error;
        // A denial will not be reversed by retrying with GPS, so stop asking.
        if (isRecord(error) && error.code === 1) {
          throw error;
        }
      }
    }
  }

  try {
    const approximate = await resolveApproximateLocationFromBackend();
    return {
      coords: {
        latitude: approximate.latitude,
        longitude: approximate.longitude,
        accuracy: approximate.accuracy ?? null,
      },
      source: "ip-approximate",
    };
  } catch (error) {
    lastError = error;
  }

  throw lastError ?? new Error("Unable to determine your location.");
}
