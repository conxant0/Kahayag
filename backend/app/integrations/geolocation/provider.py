# Defines the IP-geolocation provider contract.
from typing import Protocol


class GeolocationProvider(Protocol):
    def locate(self, ip_address: str) -> tuple[float, float]: ...
