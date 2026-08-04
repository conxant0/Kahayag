# Defines typed loaders for the Cebu City permit and document catalog JSON.

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

CATALOG_PATH = Path(__file__).resolve().parents[2] / "data" / "cebu_permits_catalog.json"

PermitTrack = Literal["streamlined", "retrofit"]
CrossCheckField = Literal[
    "registered_owner_name",
    "property_address",
    "tct_number",
    "tax_declaration_number",
    "issue_date",
]


@dataclass(frozen=True)
class PermitRequirement:
    id: str
    name: str
    issuing_agency: str
    legal_basis: str
    source_url: str
    tracks: tuple[PermitTrack, ...]
    processing_time_note: str | None
    unverified: bool
    unverified_notes: tuple[str, ...]


@dataclass(frozen=True)
class DocumentRequirement:
    id: str
    title: str
    track: PermitTrack
    obo_item: int | None
    condition: str | None
    group: str | None
    legal_basis: str
    source_url: str
    cross_check_fields: tuple[CrossCheckField, ...]
    # True/False when the research confirms a validity rule; None when the
    # research could not confirm one (e.g. barangay clearance validity for Cebu).
    expires: bool | None
    expiry_note: str | None
    unverified: bool
    # Where to get it, in plain language. A document with no fixed office
    # (e.g. a notarized instrument, or an ID the applicant already holds)
    # says so here rather than naming a government office.
    issuing_agency: str
    # Ordered, plain-language actions for obtaining the document: where to
    # go or which portal to use, what to bring, what to check before leaving
    # the counter. Sourced from the same research as legal_basis/source_url —
    # never invented (AGENTS.md rule 1).
    steps: tuple[str, ...]
    # Other document ids (from this catalog) that must be satisfied first.
    # Empty when nothing gates this document.
    prerequisites: tuple[str, ...]


@dataclass(frozen=True)
class PermitCatalog:
    schema_version: str
    permits: tuple[PermitRequirement, ...]
    documents: tuple[DocumentRequirement, ...]


def _parse_permit(raw: dict[str, Any]) -> PermitRequirement:
    return PermitRequirement(
        id=str(raw["id"]),
        name=str(raw["name"]),
        issuing_agency=str(raw["issuing_agency"]),
        legal_basis=str(raw["legal_basis"]),
        source_url=str(raw["source_url"]),
        tracks=tuple(raw["tracks"]),
        processing_time_note=raw.get("processing_time_note"),
        unverified=bool(raw.get("unverified", False)),
        unverified_notes=tuple(raw.get("unverified_notes", [])),
    )


def _parse_document(raw: dict[str, Any]) -> DocumentRequirement:
    return DocumentRequirement(
        id=str(raw["id"]),
        title=str(raw["title"]),
        track=raw["track"],
        obo_item=raw.get("obo_item"),
        condition=raw.get("condition"),
        group=raw.get("group"),
        legal_basis=str(raw["legal_basis"]),
        source_url=str(raw["source_url"]),
        cross_check_fields=tuple(raw.get("cross_check_fields", [])),
        expires=raw.get("expires"),
        expiry_note=raw.get("expiry_note"),
        unverified=bool(raw.get("unverified", False)),
        issuing_agency=str(raw["issuing_agency"]),
        steps=tuple(raw["steps"]),
        prerequisites=tuple(raw.get("prerequisites", [])),
    )


def _load_raw_catalog() -> dict[str, Any]:
    return json.loads(CATALOG_PATH.read_text())


@lru_cache(maxsize=1)
def load_catalog() -> PermitCatalog:
    raw = _load_raw_catalog()
    return PermitCatalog(
        schema_version=str(raw.get("schema_version", "1.0")),
        permits=tuple(_parse_permit(item) for item in raw["permits"]),
        documents=tuple(_parse_document(item) for item in raw["documents"]),
    )


def documents_for_track(
    track: PermitTrack, catalog: PermitCatalog | None = None
) -> list[DocumentRequirement]:
    cat = catalog or load_catalog()
    return [doc for doc in cat.documents if doc.track == track]


def permits_for_track(
    track: PermitTrack, catalog: PermitCatalog | None = None
) -> list[PermitRequirement]:
    cat = catalog or load_catalog()
    return [permit for permit in cat.permits if track in permit.tracks]
