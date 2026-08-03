# Defines short-lived cache for proxied Google Solar GeoTIFF URLs.

import secrets
import time
from dataclasses import dataclass

FLUX_LAYER_TTL_SECONDS = 3_600


@dataclass(frozen=True)
class CachedFluxLayers:
    annual_flux_url: str
    mask_url: str
    created_at: float


_layer_cache: dict[str, CachedFluxLayers] = {}


def store_flux_layers(*, annual_flux_url: str, mask_url: str) -> str:
    _purge_expired_layers()
    token = secrets.token_urlsafe(16)
    _layer_cache[token] = CachedFluxLayers(
        annual_flux_url=annual_flux_url,
        mask_url=mask_url,
        created_at=time.time(),
    )
    return token


def get_flux_layers(token: str) -> CachedFluxLayers | None:
    _purge_expired_layers()
    cached = _layer_cache.get(token)
    if cached is None:
        return None
    if time.time() - cached.created_at > FLUX_LAYER_TTL_SECONDS:
        _layer_cache.pop(token, None)
        return None
    return cached


def _purge_expired_layers() -> None:
    now = time.time()
    expired = [
        token
        for token, cached in _layer_cache.items()
        if now - cached.created_at > FLUX_LAYER_TTL_SECONDS
    ]
    for token in expired:
        _layer_cache.pop(token, None)
