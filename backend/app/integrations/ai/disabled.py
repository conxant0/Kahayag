# Defines behavior selection when no AI provider is configured.

from app.features.reports.schemas import ReportNarrative, ValidatedReportInput


class DisabledAIProvider:
    def explain(self, *, summary: str, values: dict[str, float]) -> str:
        return summary

    def write(self, report: ValidatedReportInput) -> ReportNarrative | None:
        return None
