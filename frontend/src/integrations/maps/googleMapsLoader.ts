import { useEffect, useRef, useState } from "react";

import { GOOGLE_MAPS_SCRIPT_ID } from "./googleMapsHelpers";

import type { MapStatus } from "./MapAdapter";

/** The adapter's status, under the name this module has always used. */
export type GoogleMapsStatus = MapStatus;

const LIBRARY_POLL_MS = 50;
const LIBRARY_TIMEOUT_MS = 10_000;

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

/**
 * Waits for the pieces the app actually uses, not just the bootstrap.
 *
 * The script is requested with `loading=async`, so its `load` event fires when
 * the loader arrives and the libraries follow after it, and `google.maps`
 * itself is not populated the instant the event runs. Treating that event as
 * readiness meant `google.maps.Map` could still be undefined when the first
 * caller asked for a map, which showed as a pane that silently stayed empty.
 *
 * So this polls briefly for the namespace, then asks for the map library the
 * documented way, and only reports ready once the constructor exists.
 */
async function awaitMapsLibrary(): Promise<void> {
  const deadline = Date.now() + LIBRARY_TIMEOUT_MS;

  while (!window.google?.maps && Date.now() < deadline) {
    await wait(LIBRARY_POLL_MS);
  }

  const maps = window.google?.maps;
  if (!maps) {
    throw new Error("Google Maps script loaded without its namespace.");
  }

  if (!maps.Map && maps.importLibrary) {
    await maps.importLibrary("maps");
  }

  while (!window.google?.maps?.Map && Date.now() < deadline) {
    await wait(LIBRARY_POLL_MS);
  }

  if (!window.google?.maps?.Map) {
    throw new Error("Google Maps loaded without its map library.");
  }
}

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Window is not available"));
  }

  if (window.google?.maps?.Map) {
    return Promise.resolve();
  }

  const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID);
  if (existingScript) {
    return new Promise((resolve, reject) => {
      if (window.google?.maps?.Map) {
        resolve();
        return;
      }
      existingScript.addEventListener("load", () =>
        awaitMapsLibrary().then(resolve, reject),
      );
      existingScript.addEventListener("error", () =>
        reject(new Error("Failed to load Google Maps script.")),
      );
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => awaitMapsLibrary().then(resolve, reject);
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
    window.google?.maps?.Map ? "ready" : "loading",
  );
  const hasStartedLoading = useRef(false);

  useEffect(() => {
    if (!apiKey || window.google?.maps?.Map || hasStartedLoading.current) {
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
