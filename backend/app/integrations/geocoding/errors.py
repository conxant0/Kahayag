# Defines geocoding-integration errors.


class GeocodingApiError(RuntimeError):
    """Raised when the geocoding provider returns an unexpected error response."""


class GeocodingTimeoutError(GeocodingApiError):
    """Raised when the geocoding provider does not respond in time."""
