# Defines shared backend test fixtures.

import json
from pathlib import Path

import pytest

from app.features.assessment.schemas import CompletedAssessment

FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture
def completed_assessment_data() -> dict[str, object]:
    return json.loads((FIXTURES_DIR / "completed_assessment.json").read_text())


@pytest.fixture
def completed_assessment(
    completed_assessment_data: dict[str, object],
) -> CompletedAssessment:
    return CompletedAssessment.model_validate(completed_assessment_data)


@pytest.fixture
def assessment_request_data(completed_assessment_data) -> dict[str, object]:
    return {
        "property": completed_assessment_data["property"],
        "roof": completed_assessment_data["roof"],
        "inputs": completed_assessment_data["inputs"],
    }


@pytest.fixture
def cebu_building_insights_payload() -> dict:
    return json.loads(
        (FIXTURES_DIR / "google_solar_building_insights.json").read_text()
    )
