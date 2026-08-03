# Defines the Nominatim-backed geocoding implementation.
import time

import httpx

NOMINATIM_SEARCH_PATH = "/search"
MIN_REQUEST_INTERVAL_SECONDS = 1.0


class NominatimGeocodingProvider:
    def __init__(self, *, base_url: str, user_agent: str) -> None:
        self._base_url = base_url
        self._user_agent = user_agent
        self._last_request_at = 0.0

    def geocode(self, query: str) -> tuple[float, float] | None:
        wait = MIN_REQUEST_INTERVAL_SECONDS - (time.monotonic() - self._last_request_at)
        if wait > 0:
            time.sleep(wait)

        response = httpx.get(
            f"{self._base_url}{NOMINATIM_SEARCH_PATH}",
            params={"q": query, "format": "json", "limit": 1},
            headers={"User-Agent": self._user_agent},
            timeout=10.0,
        )
        self._last_request_at = time.monotonic()
        response.raise_for_status()

        results = response.json()
        if not results:
            return None
        return float(results[0]["lat"]), float(results[0]["lon"])

    def search(self, query: str, *, limit: int = 5) -> list[dict[str, str]]:
        wait = MIN_REQUEST_INTERVAL_SECONDS - (time.monotonic() - self._last_request_at)
        if wait > 0:
            time.sleep(wait)

        response = httpx.get(
            f"{self._base_url}{NOMINATIM_SEARCH_PATH}",
            params={"q": query, "format": "json", "limit": limit},
            headers={"User-Agent": self._user_agent},
            timeout=10.0,
        )
        self._last_request_at = time.monotonic()
        response.raise_for_status()

        return response.json()
