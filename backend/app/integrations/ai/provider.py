# Defines the vendor-neutral AI report-writer contract.
from typing import Protocol


class AIReportProvider(Protocol):
    def explain(self, *, summary: str, values: dict[str, float]) -> str: ...
