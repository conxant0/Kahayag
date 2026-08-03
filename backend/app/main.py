# Defines the FastAPI application composition root.
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import router

app = FastAPI(title="Kahayag Energy API")

allowed_origins = [
    origin.strip()
    for origin in os.getenv("APP_CORS_ORIGINS", "http://localhost:5173").split(",")
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
