# Defines the encoding for provider GeoTIFF URLs carried in flux proxy paths.
# Stateless by design: the URL round-trips through the token itself, so the
# proxy endpoint works the same regardless of which server instance handles
# the /prepare and /geotiff requests.

import base64


def encode_flux_url(url: str) -> str:
    return base64.urlsafe_b64encode(url.encode()).rstrip(b"=").decode()


def decode_flux_url(token: str) -> str:
    padding = "=" * (-len(token) % 4)
    return base64.urlsafe_b64decode(token + padding).decode()
