# Defines unit tests for the six deterministic permit document check classes.

from app.domain.permits.entities import ApplicantAnswers, PermitBuildSpec
from app.features.permits.intake import UploadedDocument, assess_permit_documents
from app.integrations.ai.document_intake import DisabledDocumentIntakeClient

CLIENT = DisabledDocumentIntakeClient()


def _retrofit_applicant(**overrides: object) -> ApplicantAnswers:
    defaults: dict[str, object] = {
        "solar_in_original_permit": "no",
        "full_name": "Maria Santos",
        "is_registered_owner": True,
        "registered_owner_name": None,
    }
    defaults.update(overrides)
    return ApplicantAnswers(**defaults)  # type: ignore[arg-type]


BUILD = PermitBuildSpec(system_kwp=5.5, build_id="build-1")
ADDRESS = "123 Sample Street, Cebu City"


def test_presence_finding_for_missing_document() -> None:
    result = assess_permit_documents(
        applicant=_retrofit_applicant(),
        build=BUILD,
        property_address=ADDRESS,
        uploads=(),
        client=CLIENT,
    )
    presence_findings = [f for f in result.findings if f.category == "presence"]
    assert presence_findings
    assert all(f.severity == "blocking" for f in presence_findings)
    assert all(doc.status == "missing" for doc in result.documents)
    assert result.packet_status == "incomplete"


def test_wrong_document_in_slot_flags_missing_keyword() -> None:
    upload = UploadedDocument(
        slot_id="obo_12_barangay_clearance",
        filename="upload.txt",
        content=b"Certificate of Good Moral Character\nIssued to Maria Santos.",
    )
    result = assess_permit_documents(
        applicant=_retrofit_applicant(),
        build=BUILD,
        property_address=ADDRESS,
        uploads=(upload,),
        client=CLIENT,
    )
    wrong_slot = [
        f
        for f in result.findings
        if f.category == "wrong_slot" and f.document_id == "obo_12_barangay_clearance"
    ]
    assert len(wrong_slot) == 1
    assert wrong_slot[0].severity == "warning"


def test_unreadable_upload_never_silently_passes() -> None:
    upload = UploadedDocument(
        slot_id="obo_14_tct",
        filename="scan.txt",
        content=b"",
    )
    result = assess_permit_documents(
        applicant=_retrofit_applicant(),
        build=BUILD,
        property_address=ADDRESS,
        uploads=(upload,),
        client=CLIENT,
    )
    unreadable = [f for f in result.findings if f.category == "unreadable"]
    assert any(f.document_id == "obo_14_tct" for f in unreadable)
    assert all(f.severity == "blocking" for f in unreadable)
    doc = next(d for d in result.documents if d.document_id == "obo_14_tct")
    assert doc.status == "needs_review"


def test_address_mismatch_reports_raw_strings() -> None:
    upload = UploadedDocument(
        slot_id="obo_13_hoa_clearance",
        filename="hoa.txt",
        content=(
            b"Homeowners Association Clearance\n"
            b"Property Address: 456 Different Street, Mandaue City\n"
        ),
    )
    result = assess_permit_documents(
        applicant=_retrofit_applicant(),
        build=BUILD,
        property_address=ADDRESS,
        uploads=(upload,),
        client=CLIENT,
    )
    mismatches = [f for f in result.findings if f.category == "address_mismatch"]
    assert len(mismatches) == 1
    assert ADDRESS in mismatches[0].message
    assert "456 Different Street, Mandaue City" in mismatches[0].message


def test_name_mismatch_reports_raw_strings_not_normalised() -> None:
    upload = UploadedDocument(
        slot_id="obo_14_tct",
        filename="tct.txt",
        content=(
            b"Transfer Certificate of Title No. T-12345\n"
            b"Registered Owner: Juan Dela Cruz\n"
        ),
    )
    result = assess_permit_documents(
        applicant=_retrofit_applicant(full_name="Maria Santos"),
        build=BUILD,
        property_address=ADDRESS,
        uploads=(upload,),
        client=CLIENT,
    )
    mismatches = [f for f in result.findings if f.category == "name_mismatch"]
    assert len(mismatches) == 1
    assert "Juan Dela Cruz" in mismatches[0].message
    assert "Maria Santos" in mismatches[0].message


def test_name_normalisation_accepts_middle_initial_and_punctuation() -> None:
    upload = UploadedDocument(
        slot_id="obo_14_tct",
        filename="tct.txt",
        content=(
            b"Transfer Certificate of Title No. T-12345\n"
            b"Registered Owner: Maria S. Santos\n"
        ),
    )
    result = assess_permit_documents(
        applicant=_retrofit_applicant(full_name="Maria Santos"),
        build=BUILD,
        property_address=ADDRESS,
        uploads=(upload,),
        client=CLIENT,
    )
    assert not [f for f in result.findings if f.category == "name_mismatch"]


def test_expiry_finding_for_annual_document_with_stale_issue_date() -> None:
    upload = UploadedDocument(
        slot_id="obo_16_tax_clearance_lot",
        filename="tax-clearance.txt",
        content=(
            b"Tax Clearance\n"
            b"Registered Owner: Maria Santos\n"
            b"Property Address: 123 Sample Street, Cebu City\n"
            b"Date Issued: January 5, 2024\n"
        ),
    )
    result = assess_permit_documents(
        applicant=_retrofit_applicant(full_name="Maria Santos"),
        build=BUILD,
        property_address=ADDRESS,
        uploads=(upload,),
        client=CLIENT,
    )
    expiry = [f for f in result.findings if f.category == "expiry"]
    assert len(expiry) == 1
    assert expiry[0].document_id == "obo_16_tax_clearance_lot"


def test_expiry_skipped_where_catalog_leaves_validity_unspecified() -> None:
    """Barangay clearance validity is deliberately unspecified for Cebu
    (CLOSED-doc-reading.md). Never invent a window."""
    upload = UploadedDocument(
        slot_id="obo_12_barangay_clearance",
        filename="barangay.txt",
        content=(
            b"Barangay Clearance\n"
            b"Registered Owner: Maria Santos\n"
            b"Property Address: 123 Sample Street, Cebu City\n"
            b"Date Issued: January 5, 2020\n"
        ),
    )
    result = assess_permit_documents(
        applicant=_retrofit_applicant(full_name="Maria Santos"),
        build=BUILD,
        property_address=ADDRESS,
        uploads=(upload,),
        client=CLIENT,
    )
    assert not [f for f in result.findings if f.category == "expiry"]


def test_cross_document_name_mismatch() -> None:
    tct = UploadedDocument(
        slot_id="obo_14_tct",
        filename="tct.txt",
        content=(
            b"Transfer Certificate of Title No. T-12345\n"
            b"Registered Owner: Maria Santos\n"
        ),
    )
    tax_dec = UploadedDocument(
        slot_id="obo_15_tax_declaration_lot",
        filename="tax-dec.txt",
        content=(
            b"Tax Declaration No. TD-999\nRegistered Owner: Mario Santos\n"
        ),
    )
    result = assess_permit_documents(
        applicant=_retrofit_applicant(full_name="Maria Santos"),
        build=BUILD,
        property_address=ADDRESS,
        uploads=(tct, tax_dec),
        client=CLIENT,
    )
    cross_doc = [f for f in result.findings if f.category == "name_mismatch" and f.document_id is None]
    assert cross_doc


def test_fully_uploaded_and_matching_documents_pass_without_blocking_findings() -> None:
    """Route/packet status reflects a genuinely clean submission."""
    from app.domain.permits.catalog import load_catalog

    catalog = load_catalog()
    docs = {
        doc.id: doc
        for doc in catalog.documents
        if doc.track == "retrofit" and doc.condition != "owner_mismatch"
    }
    uploads = tuple(
        UploadedDocument(slot_id=doc_id, filename=f"{doc_id}.txt", content=doc.title.encode())
        for doc_id, doc in docs.items()
    )
    result = assess_permit_documents(
        applicant=_retrofit_applicant(),
        build=BUILD,
        property_address=ADDRESS,
        uploads=uploads,
        client=CLIENT,
    )
    assert all(doc.status == "uploaded" for doc in result.documents)
    assert not [f for f in result.findings if f.category in ("presence", "unreadable")]
    assert result.packet_status == "ready"
