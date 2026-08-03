# Defines the ip-api.com-backed IP-geolocation implementation.
import httpx

from app.integrations.geolocation.errors import GeolocationLookupError

_BASE_URL = "http://ip-api.com/json"


class IpApiGeolocationProvider:
    def locate(self, ip_address: str) -> tuple[float, float]:
        try:
            response = httpx.get(
                f"{_BASE_URL}/{ip_address}",
                params={"fields": "status,message,lat,lon"},
                timeout=5.0,
            )
            response.raise_for_status()
            payload = response.json()
        except httpx.HTTPError as error:
            raise GeolocationLookupError("Approximate location lookup failed.") from error

        if payload.get("status") != "success":
            raise GeolocationLookupError(
                payload.get("message", "Approximate location lookup failed.")
            )

        latitude = payload.get("lat")
        longitude = payload.get("lon")
        if not isinstance(latitude, (int, float)) or not isinstance(longitude, (int, float)):
            raise GeolocationLookupError("Approximate location lookup returned invalid coordinates.")

        return latitude, longitude
