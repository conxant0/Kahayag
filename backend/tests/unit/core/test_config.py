from pathlib import Path

from app.core.config import Settings


def test_settings_env_file_is_resolved_from_the_backend_directory() -> None:
    env_file = Path(Settings.model_config["env_file"])

    assert env_file.is_absolute()
    assert env_file.name == ".env"
    assert env_file.parent.name == "backend"


def test_settings_defaults() -> None:
    settings = Settings(_env_file=None)

    assert settings.env == "local"
    assert settings.cors_origins == "http://localhost:5173"
    assert settings.ai_provider == "disabled"
    assert settings.groq_api_key == ""
    assert settings.groq_model == "llama-3.3-70b-versatile"
    assert settings.nominatim_base_url == "https://nominatim.openstreetmap.org"
    assert settings.nominatim_user_agent == "kahayag-energy/1.0"
    assert settings.solar_provider == "disabled"
    assert settings.google_solar_api_key == ""


def test_settings_reads_app_env(monkeypatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")

    settings = Settings(_env_file=None)

    assert settings.env == "production"


def test_settings_reads_app_cors_origins(monkeypatch) -> None:
    monkeypatch.setenv("APP_CORS_ORIGINS", "https://kahayag.energy,https://app.kahayag.energy")

    settings = Settings(_env_file=None)

    assert settings.cors_origins == "https://kahayag.energy,https://app.kahayag.energy"


def test_settings_reads_app_prefixed_env_vars(monkeypatch) -> None:
    monkeypatch.setenv("APP_AI_PROVIDER", "groq")
    monkeypatch.setenv("APP_GROQ_API_KEY", "test-key")

    settings = Settings(_env_file=None)

    assert settings.ai_provider == "groq"
    assert settings.groq_api_key == "test-key"


def test_settings_ignores_unrelated_env_vars(monkeypatch) -> None:
    monkeypatch.setenv("UNRELATED_VAR", "should-not-appear")

    settings = Settings(_env_file=None)

    assert not hasattr(settings, "unrelated_var")
    assert not hasattr(settings, "UNRELATED_VAR")
