# Defines geolocation-integration errors.


class GeolocationLookupError(RuntimeError):
    """Raised when the IP-geolocation lookup fails or returns invalid data."""
