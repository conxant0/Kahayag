import rawFixture from "../../../backend/tests/fixtures/completed_assessment.json";
import type { AssessmentResult } from "../../src/shared/api/types";

export const assessmentFixture = rawFixture as AssessmentResult;
