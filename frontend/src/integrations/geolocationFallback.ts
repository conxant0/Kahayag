// Defines the backend-served approximate location used when the browser
// cannot answer. Named for what it does: no map provider is involved.
import { apiPost } from "../shared/api/client";
import { ENDPOINTS } from "../shared/api/endpoints";

/** The normalised location the backend returns when the browser cannot answer. */
export type ApproximateLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  source?: string | null;
};

export async function resolveApproximateLocationFromBackend() {
  return apiPost<ApproximateLocation>(ENDPOINTS.approximateLocation, {});
}
