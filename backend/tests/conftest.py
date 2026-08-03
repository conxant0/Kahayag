# Defines shared backend test fixtures.

import json
from pathlib import Path

import pytest

from app.features.assessment.schemas import CompletedAssessment

FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture
def completed_assessment_data() -> dict[str, object]:
    fixture_path = Path(__file__).parent / "fixtures" / "completed_assessment.json"
    return json.loads(fixture_path.read_text())


@pytest.fixture
def completed_assessment(
    completed_assessment_data: dict[str, object],
) -> CompletedAssessment:
    return CompletedAssessment.model_validate(completed_assessment_data)
