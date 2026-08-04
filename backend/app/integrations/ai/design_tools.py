# Defines OpenAI-compatible tool schemas for the design agent loop.

DESIGN_AGENT_SYSTEM_PROMPT = (
    "You are a solar design assistant for residential systems in the Philippines. "
    "Use the provided tools to query the catalog, run the constraint solver, and "
    "update builds. State only facts present in tool outputs. Never invent "
    "capacity, prices, payback, savings, or rejection reasons. When explaining "
    "numbers, quote them exactly as returned by tools."
)

EXPLAIN_DESIGN_SYSTEM_PROMPT = (
    "You are a friendly solar design assistant for homeowners in the Philippines. "
    "Answer the question directly in plain, conversational language — like a helpful "
    "consultant, not a spec sheet. Use 2-4 short sentences. Lead with the answer, "
    "then briefly tie it to the active build using snapshot facts. When the "
    "homeowner asks why a specific panel or component was chosen, name the active "
    "model and compare to any alternatives listed in panel_alternatives — do not "
    "deflect with generic prompts to ask other questions. Distinguish general solar "
    "questions (how grid-tied works, night use, outages) from build-specific ones "
    "(why this inverter, why this panel, why no battery here). Never dump raw "
    "insight strings, DC:AC ratios, or utilisation percentages unless the homeowner "
    "explicitly asked for technical detail. Never invent capacities, prices, payback, "
    "or savings — quote numbers exactly from the snapshot."
)

MAX_TOOL_ITERATIONS = 4

DESIGN_TOOL_SCHEMAS: tuple[dict[str, object], ...] = (
    {
        "type": "function",
        "function": {
            "name": "query_catalog",
            "description": "Filter catalog SKUs by category, wattage, brand, or price.",
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "enum": ["panels", "inverters", "batteries"],
                    },
                    "min_wattage_w": {"type": "integer"},
                    "brand": {"type": "string"},
                    "battery_compatible": {"type": "boolean"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_solver",
            "description": "Re-run the constraint solver with optional goal or budget updates.",
            "parameters": {
                "type": "object",
                "properties": {
                    "goal": {
                        "type": "string",
                        "enum": ["auto", "budget", "backup", "independence"],
                    },
                    "budget_php": {"type": "number"},
                    "require_battery": {"type": "boolean"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_rejection_reasons",
            "description": "Return rejection log rows for a solve run.",
            "parameters": {
                "type": "object",
                "properties": {
                    "solve_id": {"type": "string"},
                    "combo_key": {"type": "string"},
                },
                "required": ["solve_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_build",
            "description": (
                "Patch solver constraints from a natural-language change request "
                "and return the updated active build."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "build_id": {"type": "string"},
                    "change_request": {"type": "string"},
                },
                "required": ["build_id", "change_request"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_quotation",
            "description": "Expand the active build into a structured quotation summary.",
            "parameters": {
                "type": "object",
                "properties": {"build_id": {"type": "string"}},
                "required": ["build_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "compare_vendors",
            "description": "Return catalog min/max price tiers for a component (hackathon stub).",
            "parameters": {
                "type": "object",
                "properties": {"component_id": {"type": "string"}},
                "required": ["component_id"],
            },
        },
    },
)
