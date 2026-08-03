# Defines environment-based backend settings.
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="APP_",
        extra="ignore",
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
    )

    env: str = "local"  # local | preview | production
    cors_origins: str = "http://localhost:5173"

    ai_provider: str = "disabled"  # groq | disabled
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"

    nominatim_base_url: str = "https://nominatim.openstreetmap.org"
    nominatim_user_agent: str = "kahayag-energy/1.0"

    solar_provider: str = "disabled"  # google | disabled
    google_solar_api_key: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
