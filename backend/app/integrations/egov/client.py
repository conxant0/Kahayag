# Defines the eGov submission client protocol and a stub implementation.
#
# No public eGov PH API or documented submission schema exists (see
# CLOSED-egov-output.md). The seam is the deliverable: swapping in a real API
# later touches only this file. `submit()` takes the domain's versioned
# SubmissionPacket and never sees vendor-specific shapes outside this module.

from dataclasses import dataclass
from typing import Literal, Protocol

from app.domain.permits.entities import SubmissionPacket

SubmissionStatus = Literal["stubbed"]


@dataclass(frozen=True)
class SubmissionResult:
    status: SubmissionStatus
    reference_id: str | None
    message: str


class SubmissionClient(Protocol):
    def submit(self, packet: SubmissionPacket) -> SubmissionResult: ...


class StubSubmissionClient:
    """No live eGov PH endpoint exists. Records that the packet is ready for
    the homeowner's own physical/manual submission rather than pretending to
    file it."""

    def submit(self, packet: SubmissionPacket) -> SubmissionResult:
        return SubmissionResult(
            status="stubbed",
            reference_id=None,
            message=(
                f"No public eGov API is available yet for the {packet.track} track. "
                "Packet prepared for manual submission to the Cebu City OBO / VECO."
            ),
        )
