# Defines approximate geolocation via client IP.
import ipaddress

from fastapi import APIRouter, HTTPException, Request

from app.api.dependencies import DependsGeolocationProvider
from app.integrations.geolocation.errors import GeolocationLookupError
from app.integrations.geolocation.provider import GeolocationProvider

router = APIRouter()


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return ""


def _is_private_ip(ip_address: str) -> bool:
    try:
        return ipaddress.ip_address(ip_address).is_private
    except ValueError:
        return True


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
