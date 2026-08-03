# Defines the vendor-neutral AI report-writer contract.
from typing import Protocol

from app.features.reports.schemas import ReportNarrative, ValidatedReportInput


class AIReportProvider(Protocol):
    def explain(self, *, summary: str, values: dict[str, float]) -> str: ...

    def write(self, report: ValidatedReportInput) -> ReportNarrative | None: ...
