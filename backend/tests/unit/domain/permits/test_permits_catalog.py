# Defines permit catalog loader unit tests.

from app.domain.permits.catalog import (
    documents_for_track,
    load_catalog,
    permits_for_track,
)


def test_load_catalog_has_permits_and_documents() -> None:
    catalog = load_catalog()
    assert catalog.schema_version
    assert len(catalog.permits) >= 4
    assert len(catalog.documents) >= 15


def test_every_entry_has_a_source_url_and_legal_basis() -> None:
    catalog = load_catalog()
    for permit in catalog.permits:
        assert permit.source_url.startswith("https://")
        assert permit.legal_basis
    for doc in catalog.documents:
        assert doc.source_url.startswith("https://")
        assert doc.legal_basis


def test_unverified_flags_carry_through_from_research() -> None:
    catalog = load_catalog()
    barangay = next(d for d in catalog.documents if d.id == "obo_12_barangay_clearance")
    assert barangay.unverified is True
    assert barangay.expires is None  # validity window unspecified for Cebu, not invented
    assert "[UNVERIFIED]" in (barangay.expiry_note or "")


def test_documents_for_track_splits_streamlined_from_retrofit() -> None:
    catalog = load_catalog()
    streamlined = documents_for_track("streamlined", catalog)
    retrofit = documents_for_track("retrofit", catalog)
    assert {d.id for d in streamlined} == {
        "jmc_net_metering_application_form",
        "jmc_electrical_single_line_diagram",
        "jmc_certificate_of_completion",
    }
    assert len(retrofit) >= 14


def test_permits_for_track_building_permit_only_applies_to_retrofit() -> None:
    catalog = load_catalog()
    retrofit_permits = {p.id for p in permits_for_track("retrofit", catalog)}
    streamlined_permits = {p.id for p in permits_for_track("streamlined", catalog)}
    assert "building_permit" in retrofit_permits
    assert "building_permit" not in streamlined_permits


def test_every_document_has_steps_and_an_issuing_agency() -> None:
    catalog = load_catalog()
    for doc in catalog.documents:
        assert doc.steps, f"{doc.id} has no steps"
        assert doc.issuing_agency


def test_prerequisites_reference_valid_document_ids_in_the_same_catalog() -> None:
    catalog = load_catalog()
    known_ids = {doc.id for doc in catalog.documents}
    for doc in catalog.documents:
        assert set(doc.prerequisites) <= known_ids, f"{doc.id} has a dangling prerequisite"
        assert doc.id not in doc.prerequisites, f"{doc.id} cannot require itself"


def test_tax_clearance_requires_tax_declaration_first() -> None:
    catalog = load_catalog()
    tax_clearance = next(d for d in catalog.documents if d.id == "obo_16_tax_clearance_lot")
    assert tax_clearance.prerequisites == ("obo_15_tax_declaration_lot",)
