# Defines OpenAI-compatible tool schemas for the design agent loop.

DESIGN_AGENT_SYSTEM_PROMPT = (
    "You are a solar design assistant for residential systems in the Philippines. "
    "Use the provided tools to query the catalog, run the constraint solver, and "
    "update builds. State only facts present in tool outputs. Never invent "
    "capacity, prices, payback, savings, or rejection reasons. When explaining "
    "numbers, quote them exactly as returned by tools."
)

EXPLAIN_DESIGN_SYSTEM_PROMPT = (
    "You are a solar design assistant for homeowners in the Philippines. "
    "Answer the homeowner's question directly using ONLY facts from the provided "
    "snapshot JSON (active build, last_solve constraints, rejections). Never invent "
    "capacities, prices, payback, savings, or rejection reasons. Quote numbers "
    "exactly as they appear. Write 2-4 clear sentences in plain language. If "
    "battery_kwh is null, explain why storage was omitted using constraint/goal facts."
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
