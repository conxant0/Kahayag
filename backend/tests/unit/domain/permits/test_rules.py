# Defines permit rule unit tests: track selection, owner-mismatch branch,
# net-metering eligibility, and the submission packet shape.

import pytest

from app.domain.permits.entities import ApplicantAnswers, PermitBuildSpec
from app.domain.permits.rules import (
    build_submission_packet,
    check_net_metering_eligibility,
    required_documents,
    required_permits,
    resolve_track,
)


@pytest.mark.parametrize(
    ("answer", "expected_track"),
    [("yes", "streamlined"), ("no", "retrofit"), ("not_sure", "retrofit")],
)
def test_resolve_track(answer: str, expected_track: str) -> None:
    assert resolve_track(answer) == expected_track


def test_streamlined_track_has_exactly_three_documents() -> None:
    applicant = ApplicantAnswers(
        solar_in_original_permit="yes",
        full_name="Juan Dela Cruz",
        is_registered_owner=True,
    )
    docs = required_documents(applicant)
    assert len(docs) == 3
    assert {d.id for d in docs} == {
        "jmc_net_metering_application_form",
        "jmc_electrical_single_line_diagram",
        "jmc_certificate_of_completion",
    }


def test_retrofit_track_excludes_owner_mismatch_docs_when_owner_matches() -> None:
    applicant = ApplicantAnswers(
        solar_in_original_permit="no",
        full_name="Juan Dela Cruz",
        is_registered_owner=True,
    )
    docs = required_documents(applicant)
    owner_mismatch_ids = {
        "obo_17_deed_of_absolute_sale",
        "obo_18_consent_and_authority",
        "obo_19_contract_of_lease_lot",
        "obo_24_special_power_of_attorney",
    }
    assert not (owner_mismatch_ids & {d.id for d in docs})


def test_retrofit_track_includes_owner_mismatch_docs_when_owner_differs() -> None:
    applicant = ApplicantAnswers(
        solar_in_original_permit="not_sure",
        full_name="Maria Santos",
        is_registered_owner=False,
        registered_owner_name="Juan Dela Cruz",
    )
    docs = required_documents(applicant)
    doc_ids = {d.id for d in docs}
    assert {
        "obo_17_deed_of_absolute_sale",
        "obo_18_consent_and_authority",
        "obo_19_contract_of_lease_lot",
        "obo_24_special_power_of_attorney",
    } <= doc_ids


def test_delegation_alone_triggers_spa_when_applicant_is_owner() -> None:
    """The registered owner delegates filing to their installer while still
    being the owner: obo_17/18/19 (which need an owner-mismatch reason)
    stay excluded, but obo_24 (the SPA) fires because item 24 is triggered by
    either condition per the OBO checklist."""
    applicant = ApplicantAnswers(
        solar_in_original_permit="no",
        full_name="Juan Dela Cruz",
        is_registered_owner=True,
        delegates_filing_to_representative=True,
    )
    doc_ids = {d.id for d in required_documents(applicant)}
    assert "obo_24_special_power_of_attorney" in doc_ids
    assert not (
        {"obo_17_deed_of_absolute_sale", "obo_18_consent_and_authority",
         "obo_19_contract_of_lease_lot"}
        & doc_ids
    )


def test_owner_mismatch_alone_still_triggers_spa_without_delegation_flag() -> None:
    """Existing owner-mismatch path is unchanged: delegation defaults False."""
    applicant = ApplicantAnswers(
        solar_in_original_permit="not_sure",
        full_name="Maria Santos",
        is_registered_owner=False,
        registered_owner_name="Juan Dela Cruz",
    )
    doc_ids = {d.id for d in required_documents(applicant)}
    assert applicant.delegates_filing_to_representative is False
    assert "obo_24_special_power_of_attorney" in doc_ids


def test_owner_mismatch_and_delegation_together_still_trigger_spa_once() -> None:
    applicant = ApplicantAnswers(
        solar_in_original_permit="not_sure",
        full_name="Maria Santos",
        is_registered_owner=False,
        registered_owner_name="Juan Dela Cruz",
        delegates_filing_to_representative=True,
    )
    docs = required_documents(applicant)
    spa_matches = [d for d in docs if d.id == "obo_24_special_power_of_attorney"]
    assert len(spa_matches) == 1


def test_retrofit_track_always_includes_renovation_proof_alternatives() -> None:
    applicant = ApplicantAnswers(
        solar_in_original_permit="no", full_name="Juan Dela Cruz", is_registered_owner=True
    )
    doc_ids = {d.id for d in required_documents(applicant)}
    assert "obo_20_occupancy_certificate" in doc_ids
    assert "obo_21_tax_declaration_and_clearance_building" in doc_ids


def test_net_metering_eligibility_satisfied_for_residential_system() -> None:
    check = check_net_metering_eligibility(PermitBuildSpec(system_kwp=8.4))
    assert check.satisfied is True
    assert check.cap_kwp == 100.0


def test_net_metering_eligibility_fails_above_cap() -> None:
    check = check_net_metering_eligibility(PermitBuildSpec(system_kwp=120.0))
    assert check.satisfied is False


def test_required_permits_differ_by_track() -> None:
    streamlined_applicant = ApplicantAnswers(
        solar_in_original_permit="yes", full_name="Juan Dela Cruz", is_registered_owner=True
    )
    retrofit_applicant = ApplicantAnswers(
        solar_in_original_permit="no", full_name="Juan Dela Cruz", is_registered_owner=True
    )
    streamlined_ids = {p.id for p in required_permits(streamlined_applicant)}
    retrofit_ids = {p.id for p in required_permits(retrofit_applicant)}
    assert "building_permit" not in streamlined_ids
    assert "building_permit" in retrofit_ids


def test_submission_packet_shape_and_versioning() -> None:
    applicant = ApplicantAnswers(
        solar_in_original_permit="not_sure",
        full_name="Maria Santos",
        is_registered_owner=False,
        registered_owner_name="Juan Dela Cruz",
    )
    build = PermitBuildSpec(system_kwp=6.6, build_id="build_001")
    packet = build_submission_packet(build, applicant)

    assert packet.schema_version == "1.0"
    assert packet.track == "retrofit"
    assert packet.applicant.full_name == "Maria Santos"
    assert packet.applicant.is_registered_owner is False
    assert packet.applicant.registered_owner_name == "Juan Dela Cruz"
    assert packet.build_ref == "build_001"
    assert packet.net_metering_eligibility.satisfied is True
    assert len(packet.permits) >= 1
    assert all(entry.status == "pending" for entry in packet.documents)
    assert {entry.document_id for entry in packet.documents} == {
        d.id for d in required_documents(applicant)
    }


def test_submission_packet_build_ref_falls_back_to_system_kwp_when_no_build_id() -> None:
    applicant = ApplicantAnswers(
        solar_in_original_permit="yes", full_name="Juan Dela Cruz", is_registered_owner=True
    )
    packet = build_submission_packet(PermitBuildSpec(system_kwp=5.0), applicant)
    assert packet.build_ref == "system_kwp:5.0"
