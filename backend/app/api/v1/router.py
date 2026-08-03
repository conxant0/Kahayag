# Defines version-one API router composition.
from fastapi import APIRouter

from app.api.v1 import health, properties

router = APIRouter(prefix="/v1")
router.include_router(health.router)
router.include_router(properties.router)
