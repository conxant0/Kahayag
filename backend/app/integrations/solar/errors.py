# Defines solar-integration errors.


class SolarProviderDisabledError(RuntimeError):
    """Raised when shading analysis is requested without a configured provider."""


class BuildingNotFoundError(LookupError):
    """Raised when the Solar API cannot locate a building near the query point."""


class SolarApiError(RuntimeError):
    """Raised when the Solar API returns an unexpected error response."""
