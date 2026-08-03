# Defines version-one API router composition.
from fastapi import APIRouter

from app.api.v1 import health
from app.features.assessment import router as assessment_router

router = APIRouter(prefix="/v1")
router.include_router(health.router)
router.include_router(assessment_router.router)
