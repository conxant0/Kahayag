# Defines version-one API router composition.
from fastapi import APIRouter

from app.api.v1 import health, properties
from app.features.assessment import router as assessment_router
from app.features.geolocation.router import router as geolocation_router
from app.features.reports.router import router as reports_router
from app.features.solar_flux.router import router as solar_flux_router

router = APIRouter(prefix="/v1")
router.include_router(health.router)
router.include_router(properties.router)
router.include_router(geolocation_router)
router.include_router(reports_router)
router.include_router(solar_flux_router)
router.include_router(assessment_router.router)
