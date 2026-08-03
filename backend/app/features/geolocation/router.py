# Defines approximate geolocation via client IP.

from fastapi import APIRouter, HTTPException, Request

from app.api.dependencies import DependsGeolocationProvider
from app.integrations.geolocation.errors import GeolocationLookupError
from app.integrations.geolocation.provider import GeolocationProvider

router = APIRouter()

_PRIVATE_IP_PREFIXES = ("127.", "10.", "192.168.", "172.16.", "172.17.", "172.18.", "172.19.")
_PRIVATE_IP_PREFIXES += tuple(f"172.{octet}." for octet in range(20, 32))
_PRIVATE_IP_EXACT = frozenset({"::1", "0.0.0.0", "localhost", "testclient"})


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return ""


def _is_private_ip(ip_address: str) -> bool:
    if not ip_address or ip_address in _PRIVATE_IP_EXACT:
        return True
    if ip_address.startswith("::ffff:127."):
        return True
    return ip_address.startswith(_PRIVATE_IP_PREFIXES)


@router.post("/geolocation/approximate")
def resolve_approximate_location(
    request: Request,
    geolocation_provider: GeolocationProvider = DependsGeolocationProvider,
) -> dict:
    """Return coarse coordinates from the caller's public IP address."""
    client_ip = _client_ip(request)
    if _is_private_ip(client_ip):
        raise HTTPException(
            status_code=503,
            detail=(
                "Approximate location is unavailable on localhost. "
                "Search your address or tap Select from map instead."
            ),
        )

    try:
        latitude, longitude = geolocation_provider.locate(client_ip)
    except GeolocationLookupError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    return {
        "latitude": latitude,
        "longitude": longitude,
        "accuracy": 5000,
        "source": "ip-approximate",
    }
