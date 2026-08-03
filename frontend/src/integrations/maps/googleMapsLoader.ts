import { useEffect, useRef, useState } from "react";

import { GOOGLE_MAPS_SCRIPT_ID } from "./googleMapsHelpers";

export type GoogleMapsStatus = "loading" | "ready" | "failed" | "missing-key";

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Window is not available"));
  }

  if (window.google?.maps) {
    return Promise.resolve();
  }

  const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID);
  if (existingScript) {
    return new Promise((resolve, reject) => {
      if (window.google?.maps) {
        resolve();
        return;
      }
      existingScript.addEventListener("load", () => resolve());
      existingScript.addEventListener("error", () =>
        reject(new Error("Failed to load Google Maps script.")),
      );
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Failed to load Google Maps script."));
    document.head.appendChild(script);
  });
}

export function useGoogleMapsLoader(
  apiKey: string | undefined,
): GoogleMapsStatus {
  // Already on the page from an earlier mount, so there is nothing to wait for.
  const [status, setStatus] = useState<GoogleMapsStatus>(() =>
    window.google?.maps ? "ready" : "loading",
  );
  const hasStartedLoading = useRef(false);

  useEffect(() => {
    if (!apiKey || window.google?.maps || hasStartedLoading.current) {
      return;
    }

    hasStartedLoading.current = true;

    loadGoogleMapsScript(apiKey)
      .then(() => setStatus("ready"))
      .catch(() => setStatus("failed"));
  }, [apiKey]);

  // A missing key is a configuration fact rather than a load outcome, so it is
  // derived here instead of being pushed through state by an effect.
  return apiKey ? status : "missing-key";
}
