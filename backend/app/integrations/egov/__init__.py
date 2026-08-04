# Defines the eGov submission integration package.
from app.integrations.egov.client import (
    StubSubmissionClient,
    SubmissionClient,
    SubmissionResult,
)

__all__ = ["StubSubmissionClient", "SubmissionClient", "SubmissionResult"]
