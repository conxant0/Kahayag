# Defines the FastAPI application composition root.
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import router
from app.core.config import get_settings

settings = get_settings()

if settings.env == "production" and settings.cors_origins == "http://localhost:5173":
    raise RuntimeError(
        "APP_CORS_ORIGINS must be configured when APP_ENV=production."
    )

docs_url = None if settings.env == "production" else "/docs"
redoc_url = None if settings.env == "production" else "/redoc"

app = FastAPI(title="Kahayag Energy API", docs_url=docs_url, redoc_url=redoc_url)

allowed_origins = [origin.strip() for origin in settings.cors_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
