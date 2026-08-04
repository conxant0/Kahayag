# Defines design feature API schemas.

from typing import Literal

from pydantic import Field, StrictBool, StrictFloat, StrictInt

from app.shared.schemas import ContractModel

SolverGoal = Literal["auto", "budget", "backup", "independence"]
BuildSource = Literal["ai_suggested", "custom", "user", "uploaded"]
ComponentSlot = Literal[
    "panel",
    "inverter",
    "battery",
    "protection",
    "structure",
    "electrical",
    "installation",
]


class DesignComponentSchema(ContractModel):
    slot: ComponentSlot
    catalog_id: str | None = None
    brand: str
    model: str
    summary: str
    qty: StrictFloat = Field(gt=0)
    unit: str
    unit_price_php: StrictFloat = Field(ge=0)
    price_as_of: str | None = None
    line_total_php: StrictFloat = Field(ge=0)
    warranty_note: str
    badges: tuple[str, ...] = ()
    specs: dict[str, str | float | int] = Field(default_factory=dict)


class RejectionReasonSchema(ContractModel):
    combo_key: str
    code: str
    message: str
    details: dict[str, str | float | int] = Field(default_factory=dict)


class SolverConstraintsSchema(ContractModel):
    target_kwp: StrictFloat = Field(gt=0)
    max_panel_count: StrictInt = Field(gt=0)
    usable_roof_area_m2: StrictFloat = Field(gt=0)
    budget_php: StrictFloat | None = Field(default=None, gt=0)
    require_battery: StrictBool = False
    min_battery_kwh: StrictFloat | None = Field(default=None, gt=0)
    goal: SolverGoal = "auto"


class ValidComboSchema(ContractModel):
    combo_id: str
    panel_id: str
    inverter_id: str
    battery_id: str | None = None
    panel_count: StrictInt = Field(gt=0)
    system_kwp: StrictFloat = Field(gt=0)
    dc_ac_ratio: StrictFloat = Field(gt=0)
    inverter_utilisation_pct: StrictFloat = Field(ge=0)
    fit_score: StrictFloat = Field(ge=0, le=100)
    rejection_log_ref: str
    estimated_cost_php: StrictFloat = Field(ge=0)


class SolveResultSchema(ContractModel):
    solve_id: str
    constraints: SolverConstraintsSchema
    valid: tuple[ValidComboSchema, ...]
    rejections: tuple[RejectionReasonSchema, ...]


class DesignBuildSchema(ContractModel):
    id: str
    label: str
    tags: tuple[str, ...]
    combo_id: str
    solve_id: str
    system_kwp: StrictFloat = Field(gt=0)
    panel_count: StrictInt = Field(gt=0)
    inverter_kw: StrictFloat = Field(gt=0)
    battery_kwh: StrictFloat | None = Field(default=None, gt=0)
    monthly_savings_php: StrictFloat = Field(ge=0)
    annual_savings_php: StrictFloat = Field(ge=0)
    payback_years: StrictFloat | None = Field(default=None, ge=0)
    total_investment_php: StrictFloat = Field(ge=0)
    subtotal_php: StrictFloat = Field(ge=0)
    vat_php: StrictFloat = Field(ge=0)
    inverter_utilisation_pct: StrictFloat = Field(ge=0)
    fit_score: StrictFloat = Field(ge=0, le=100)
    co2_tonnes_avoided_yearly: StrictFloat = Field(ge=0)
    insight: str
    components: tuple[DesignComponentSchema, ...]
    source: BuildSource


class AgentAuditEntrySchema(ContractModel):
    turn_id: str
    user_text: str
    tool_calls: tuple[dict[str, object], ...] = ()
    solve_ids: tuple[str, ...] = ()
    final_build_id: str | None = None


class DesignSessionSchema(ContractModel):
    property_ref: str
    assessment_fingerprint: str
    active_build_id: str
    # A session with no builds has nothing to mutate, optimise, or benchmark —
    # rejecting it at the schema (422) beats an IndexError (500) downstream.
    builds: tuple[DesignBuildSchema, ...] = Field(min_length=1)
    last_solve: SolveResultSchema | None = None
    applied: StrictBool = False
    agent_audit: tuple[AgentAuditEntrySchema, ...] = ()


class QuotationLineSchema(ContractModel):
    item: str
    description: str
    brand: str
    uom: str
    qty: StrictFloat = Field(gt=0)
    unit_price_php: StrictFloat = Field(ge=0)
    amount_php: StrictFloat = Field(ge=0)
    price_as_of: str | None = None


class QuotationDocumentSchema(ContractModel):
    build_id: str
    quote_number: str
    quote_date: str
    validity_days: StrictInt = Field(gt=0)
    lines: tuple[QuotationLineSchema, ...]
    subtotal_php: StrictFloat = Field(ge=0)
    vat_php: StrictFloat = Field(ge=0)
    total_php: StrictFloat = Field(ge=0)
    payment_terms: str
    warranty_summary: str
    is_draft: StrictBool = True


class BootstrapDesignRequest(ContractModel):
    assessment: dict[str, object]
    property_ref: str = Field(min_length=1)


class OptimiseDesignRequest(ContractModel):
    session: DesignSessionSchema
    goal: SolverGoal


class MutateDesignRequest(ContractModel):
    session: DesignSessionSchema
    goal: SolverGoal | None = None
    budget_php: StrictFloat | None = Field(default=None, gt=0)
    require_battery: StrictBool | None = None
    min_battery_kwh: StrictFloat | None = Field(default=None, gt=0)
    locked_panel_id: str | None = None
    locked_inverter_id: str | None = None
    panel_count_delta: StrictInt | None = None


class GenerateQuotationRequest(ContractModel):
    build_id: str = Field(min_length=1)
    session: DesignSessionSchema


class AgentDesignRequest(ContractModel):
    session: DesignSessionSchema
    user_text: str = Field(min_length=1)
    dry_run: StrictBool = False


class PlannedActionSchema(ContractModel):
    name: str
    arguments: dict[str, object] = Field(default_factory=dict)


class AgentDesignResponse(ContractModel):
    session: DesignSessionSchema
    reply: str
    requires_confirmation: StrictBool = False
    planned_actions: tuple[PlannedActionSchema, ...] = ()


class ExplainDesignRequest(ContractModel):
    session: DesignSessionSchema
    question: str = Field(min_length=1)


class ExplainDesignResponse(ContractModel):
    explanation: str


class QuoteAuditFindingSchema(ContractModel):
    category: str
    severity: Literal["info", "warning", "positive"]
    message: str


class QuoteAuditResponseSchema(ContractModel):
    filename: str
    extracted_total_php: StrictFloat | None = None
    extracted_system_kwp: StrictFloat | None = None
    benchmark_total_php: StrictFloat = Field(ge=0)
    benchmark_system_kwp: StrictFloat = Field(gt=0)
    findings: tuple[QuoteAuditFindingSchema, ...] = ()
    summary: str
