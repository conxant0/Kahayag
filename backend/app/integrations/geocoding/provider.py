# Defines the optional backend geocoding contract.
from typing import Protocol


class GeocodingProvider(Protocol):
    def geocode(self, query: str) -> tuple[float, float] | None: ...
