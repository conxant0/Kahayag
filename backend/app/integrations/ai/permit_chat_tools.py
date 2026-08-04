# Defines OpenAI-compatible tool schemas and prompts for the permits chat
# turn. Every tool sets an applicant input only — the finding, status, and
# verdict are always recomputed deterministically afterwards by
# app.domain.permits and app.features.permits.intake (AGENTS.md rule 1).

PERMIT_CHAT_SYSTEM_PROMPT = (
    "You are a permit compliance assistant for homeowners submitting solar "
    "installation permits in Cebu City, Philippines. Use the provided tools "
    "ONLY to record applicant inputs: the original-permit track answer, the "
    "applicant name, the registered-owner answer, whether the applicant is "
    "delegating the act of filing to a representative (e.g. their "
    "installer), and which uploaded document occupies which checklist slot. "
    "You never decide whether a "
    "document is acceptable, and never set a finding, a status, or a "
    "verdict — those are always computed by the backend after your tool "
    "call. If the user is asking a question rather than giving you an "
    "input to record, call no tools."
)

PERMIT_QA_SYSTEM_PROMPT = (
    "You are a permit compliance assistant answering a homeowner's question "
    "about their Cebu City solar permit packet. Answer using ONLY the "
    "grounding JSON provided: catalog documents and permits (with "
    "legal_basis and source_url), and computed findings. When you state a "
    "requirement, cite its source_url. If the grounding entry has "
    "unverified: true, say plainly that the requirement could not be "
    "confirmed in research and should be checked with the issuing office. "
    "If the grounding does not cover the question, say the catalog does not "
    "have that information. Never answer a Philippine permitting question "
    "from your own pretrained knowledge."
)

MAX_TOOL_ITERATIONS = 4

PERMIT_CHAT_TOOL_SCHEMAS: tuple[dict[str, object], ...] = (
    {
        "type": "function",
        "function": {
            "name": "set_original_permit_track",
            "description": (
                "Record whether solar was included in the original building "
                "permit."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "answer": {"type": "string", "enum": ["yes", "no", "not_sure"]},
                },
                "required": ["answer"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "set_applicant_name",
            "description": "Record the applicant's full name.",
            "parameters": {
                "type": "object",
                "properties": {"full_name": {"type": "string"}},
                "required": ["full_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "set_owner_answer",
            "description": (
                "Record whether the applicant is the registered property "
                "owner, and the registered owner's name if not."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "is_registered_owner": {"type": "boolean"},
                    "registered_owner_name": {"type": ["string", "null"]},
                },
                "required": ["is_registered_owner"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "set_delegation_answer",
            "description": (
                "Record whether the applicant (as registered owner) is "
                "delegating the act of filing the permit to a representative, "
                "such as their solar installer."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "delegates_filing_to_representative": {"type": "boolean"},
                },
                "required": ["delegates_filing_to_representative"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "assign_document_slot",
            "description": (
                "Assign an uploaded file (by filename) to a checklist slot, "
                "or clear a slot by omitting the filename."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "slot_id": {"type": "string"},
                    "filename": {"type": ["string", "null"]},
                },
                "required": ["slot_id"],
            },
        },
    },
)
