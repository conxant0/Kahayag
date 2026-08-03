# Verifies environment-driven app composition: docs visibility and CORS enforcement.
import importlib
import sys

import pytest


def _reimport_main():
    sys.modules.pop("app.main", None)
    sys.modules.pop("app.core.config", None)
    config = importlib.import_module("app.core.config")
    config.get_settings.cache_clear()
    return importlib.import_module("app.main")


def _reset_env(monkeypatch) -> None:
    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.delenv("APP_CORS_ORIGINS", raising=False)


@pytest.fixture(autouse=True)
def _restore_main_module():
    yield
    # Reimport with a clean environment so later test files that do
    # `from app.main import app` at collection time are unaffected.
    _reimport_main()


def test_docs_open_by_default(monkeypatch) -> None:
    _reset_env(monkeypatch)

    main = _reimport_main()

    assert main.app.docs_url == "/docs"
    assert main.app.redoc_url == "/redoc"


def test_docs_closed_in_production(monkeypatch) -> None:
    _reset_env(monkeypatch)
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("APP_CORS_ORIGINS", "https://kahayag.energy")

    main = _reimport_main()

    assert main.app.docs_url is None
    assert main.app.redoc_url is None


def test_production_requires_configured_cors_origins(monkeypatch) -> None:
    _reset_env(monkeypatch)
    monkeypatch.setenv("APP_ENV", "production")

    with pytest.raises(RuntimeError, match="APP_CORS_ORIGINS"):
        _reimport_main()
