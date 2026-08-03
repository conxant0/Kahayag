import { apiPost } from "../../shared/api/client";

/** The normalised location the backend returns when the browser cannot answer. */
export type ApproximateLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  source?: string | null;
};

export async function resolveApproximateLocationFromBackend() {
  return apiPost<ApproximateLocation>("/geolocation/approximate", {});
}
