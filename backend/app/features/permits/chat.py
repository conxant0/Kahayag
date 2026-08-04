# Defines the permits chat turn: dispatches input-setting tool calls and
# grounded Q&A, then always recomputes the assessment deterministically via
# app.domain.permits and app.features.permits.intake.
#
# Hard boundary (AGENTS.md rule 1, CLOSED-ai-surface.md): every tool below
# sets an applicant input only. None constructs a PermitFindingSchema, a
# checklist status, or a packet verdict — those only ever come from
# assess_permit_documents, called unconditionally at the end of every turn.

from dataclasses import replace

from app.domain.permits.catalog import load_catalog
from app.domain.permits.entities import ApplicantAnswers, PermitBuildSpec
from app.domain.permits.rules import required_documents
from app.features.permits.intake import UploadedDocument, assess_permit_documents
from app.features.permits.schemas import (
    ApplicantAnswersSchema,
    PermitAssessmentResponseSchema,
    PermitChatResponseSchema,
)
from app.integrations.ai.document_intake import DocumentIntakeClient
from app.integrations.ai.permit_chat_agent import (
    PermitChatClient,
    PlannedPermitToolCall,
    is_question_only,
)


def _execute_tool(
    call: PlannedPermitToolCall,
    *,
    applicant: ApplicantAnswers,
    slot_by_filename: dict[str, str | None],
) -> tuple[dict[str, object], ApplicantAnswers, dict[str, str | None]]:
    """Dispatches one planned tool call. This if/elif ladder IS the tool
    allowlist: any name not matched here falls through to the final "Unknown
    tool" branch and mutates nothing."""

    if call.name == "set_original_permit_track":
        answer = str(call.arguments.get("answer", ""))
        if answer not in ("yes", "no", "not_sure"):
            return {"error": f"Invalid track answer: {answer!r}"}, applicant, slot_by_filename
        updated = replace(applicant, solar_in_original_permit=answer)
        return {"solar_in_original_permit": answer}, updated, slot_by_filename

    if call.name == "set_applicant_name":
        full_name = str(call.arguments.get("full_name", "")).strip()
        if not full_name:
            return {"error": "full_name is required"}, applicant, slot_by_filename
        updated = replace(applicant, full_name=full_name)
        return {"full_name": full_name}, updated, slot_by_filename

    if call.name == "set_owner_answer":
        is_owner = bool(call.arguments.get("is_registered_owner", False))
        raw_owner_name = call.arguments.get("registered_owner_name")
        owner_name = str(raw_owner_name).strip() if raw_owner_name else None
        updated = replace(
            applicant,
            is_registered_owner=is_owner,
            registered_owner_name=None if is_owner else owner_name,
        )
        return (
            {
                "is_registered_owner": is_owner,
                "registered_owner_name": updated.registered_owner_name,
            },
            updated,
            slot_by_filename,
        )

    if call.name == "set_delegation_answer":
        delegates = bool(call.arguments.get("delegates_filing_to_representative", False))
        updated = replace(applicant, delegates_filing_to_representative=delegates)
        return (
            {"delegates_filing_to_representative": delegates},
            updated,
            slot_by_filename,
        )

    if call.name == "assign_document_slot":
        slot_id = str(call.arguments.get("slot_id", "")).strip()
        if not slot_id:
            return {"error": "slot_id is required"}, applicant, slot_by_filename
        raw_filename = call.arguments.get("filename")
        filename = str(raw_filename).strip() if raw_filename else None
        if filename is not None and filename not in slot_by_filename:
            return {"error": f"Unknown uploaded file: {filename}"}, applicant, slot_by_filename
        updated_map = dict(slot_by_filename)
        for existing_filename, existing_slot in slot_by_filename.items():
            if existing_slot == slot_id:
                updated_map[existing_filename] = None
        if filename is not None:
            updated_map[filename] = slot_id
        return {"slot_id": slot_id, "filename": filename}, applicant, updated_map

    return {"error": f"Unknown tool: {call.name}"}, applicant, slot_by_filename


def _grounding_snapshot(
    *,
    applicant: ApplicantAnswers,
    assessment: PermitAssessmentResponseSchema,
) -> dict[str, object]:
    catalog = load_catalog()
    required_docs = required_documents(applicant, catalog)
    required_doc_ids = {doc.id for doc in required_docs}
    return {
        "track": assessment.track,
        "packet_status": assessment.packet_status,
        "required_document_ids": sorted(required_doc_ids),
        "documents": [
            {
                "id": doc.id,
                "title": doc.title,
                "track": doc.track,
                "condition": doc.condition,
                "group": doc.group,
                "obo_item": doc.obo_item,
                "legal_basis": doc.legal_basis,
                "source_url": doc.source_url,
                "unverified": doc.unverified,
            }
            for doc in catalog.documents
        ],
        "permits": [
            {
                "id": permit.id,
                "name": permit.name,
                "issuing_agency": permit.issuing_agency,
                "legal_basis": permit.legal_basis,
                "source_url": permit.source_url,
                "unverified": permit.unverified,
                "unverified_notes": list(permit.unverified_notes),
            }
            for permit in catalog.permits
        ],
        "findings": [finding.model_dump() for finding in assessment.findings],
    }


def run_permit_chat_turn(
    *,
    applicant: ApplicantAnswers,
    build: PermitBuildSpec,
    property_address: str,
    uploads: tuple[UploadedDocument, ...],
    user_text: str,
    chat_client: PermitChatClient,
    intake_client: DocumentIntakeClient,
) -> PermitChatResponseSchema:
    # An empty-string slot_id means "not yet assigned to a slot" — the same
    # as None, so both count as unassigned when filtering uploads below.
    slot_by_filename: dict[str, str | None] = {
        upload.filename: (upload.slot_id or None) for upload in uploads
    }

    # Deterministic gate: a message that reads as a plain question never
    # reaches tool planning, so the loose regex fallbacks below can't
    # misclassify it as an applicant-detail update (see is_question_only).
    if is_question_only(user_text):
        planned: tuple[PlannedPermitToolCall, ...] = ()
    else:
        planned = chat_client.plan_tool_calls(
            user_text=user_text,
            applicant={
                "solar_in_original_permit": applicant.solar_in_original_permit,
                "full_name": applicant.full_name,
                "is_registered_owner": applicant.is_registered_owner,
                "registered_owner_name": applicant.registered_owner_name,
                "delegates_filing_to_representative": (
                    applicant.delegates_filing_to_representative
                ),
            },
            uploaded_filenames=tuple(slot_by_filename.keys()),
        )

    tool_audit: list[dict[str, object]] = []
    updated_applicant = applicant
    updated_slot_by_filename = slot_by_filename
    for call in planned:
        before_applicant = updated_applicant
        before_slot_by_filename = updated_slot_by_filename
        result, updated_applicant, updated_slot_by_filename = _execute_tool(
            call,
            applicant=updated_applicant,
            slot_by_filename=updated_slot_by_filename,
        )
        is_error = isinstance(result, dict) and bool(result.get("error"))
        # A no-op (the value it would set already matches the current one)
        # is dropped from the audit rather than reported as an "Updated: …"
        # — this is what keeps a classifier miss from being destructive.
        if not is_error and (
            updated_applicant == before_applicant
            and updated_slot_by_filename == before_slot_by_filename
        ):
            continue
        tool_audit.append({"name": call.name, "arguments": call.arguments, "result": result})

    updated_uploads = tuple(
        UploadedDocument(slot_id=slot_id, filename=upload.filename, content=upload.content)
        for upload in uploads
        if (slot_id := updated_slot_by_filename.get(upload.filename)) is not None
    )

    # The only recomputation path: no tool above can shortcut this.
    assessment = assess_permit_documents(
        applicant=updated_applicant,
        build=build,
        property_address=property_address,
        uploads=updated_uploads,
        client=intake_client,
    )

    if tool_audit:
        reply = chat_client.generate_turn_reply(
            user_text=user_text,
            tool_audit=tool_audit,
            assessment=assessment.model_dump(),
        )
    else:
        grounding = _grounding_snapshot(applicant=updated_applicant, assessment=assessment)
        reply = chat_client.answer_question(user_text=user_text, grounding=grounding)

    return PermitChatResponseSchema(
        reply=reply,
        applicant=ApplicantAnswersSchema(
            solar_in_original_permit=updated_applicant.solar_in_original_permit,
            full_name=updated_applicant.full_name,
            is_registered_owner=updated_applicant.is_registered_owner,
            registered_owner_name=updated_applicant.registered_owner_name,
            delegates_filing_to_representative=updated_applicant.delegates_filing_to_representative,
        ),
        assessment=assessment,
    )
