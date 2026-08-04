# Defines design feature API schemas.

from typing import Literal

from pydantic import Field, StrictBool, StrictFloat, StrictInt, model_validator

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
    product_image: str | None = None


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
    system_kwp: StrictFloat = Field(ge=0)
    panel_count: StrictInt = Field(ge=0)
    inverter_kw: StrictFloat = Field(ge=0)
    battery_kwh: StrictFloat | None = Field(default=None, gt=0)
    monthly_savings_php: StrictFloat = Field(ge=0)
    annual_savings_php: StrictFloat = Field(ge=0)
    payback_years: StrictFloat | None = Field(default=None, ge=0)
    total_investment_php: StrictFloat = Field(ge=0)
    total_investment_low_php: StrictFloat = Field(ge=0)
    total_investment_high_php: StrictFloat = Field(ge=0)
    subtotal_php: StrictFloat = Field(ge=0)
    vat_php: StrictFloat = Field(ge=0)
    inverter_utilisation_pct: StrictFloat = Field(ge=0)
    fit_score: StrictFloat = Field(ge=0, le=100)
    co2_tonnes_avoided_yearly: StrictFloat = Field(ge=0)
    insight: str
    components: tuple[DesignComponentSchema, ...]
    source: BuildSource

    @model_validator(mode="after")
    def validate_investment_range(self) -> "DesignBuildSchema":
        if self.total_investment_high_php < self.total_investment_low_php:
            raise ValueError("total_investment_high_php must be >= total_investment_low_php")
        return self


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
    homeowner_plans: dict[str, object] | None = None


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
    total_low_php: StrictFloat = Field(ge=0)
    total_high_php: StrictFloat = Field(ge=0)
    payment_terms: str
    warranty_summary: str
    is_draft: StrictBool = True


class BootstrapDesignRequest(ContractModel):
    assessment: dict[str, object]
    property_ref: str = Field(min_length=1)
    plans: dict[str, object] | None = None


class OptimiseDesignRequest(ContractModel):
    session: DesignSessionSchema
    goal: SolverGoal


CatalogOptionStatus = Literal["selected", "recommended", "compatible", "incompatible"]
CatalogPickerSlot = Literal["panel", "inverter", "battery"]


class MutateDesignRequest(ContractModel):
    session: DesignSessionSchema
    goal: SolverGoal | None = None
    budget_php: StrictFloat | None = Field(default=None, gt=0)
    require_battery: StrictBool | None = None
    min_battery_kwh: StrictFloat | None = Field(default=None, gt=0)
    locked_panel_id: str | None = None
    locked_inverter_id: str | None = None
    locked_battery_id: str | None = None
    panel_count_delta: StrictInt | None = None
    seed_panel_count: StrictInt | None = Field(default=None, gt=0)
    swap_slot: CatalogPickerSlot | None = None
    prefer_cheaper: StrictBool | None = None


class CreateUserBuildRequest(ContractModel):
    session: DesignSessionSchema


class UpdateUserBuildComponentRequest(ContractModel):
    session: DesignSessionSchema
    build_id: str = Field(min_length=1)
    slot: CatalogPickerSlot
    catalog_id: str = Field(min_length=1)


class ManageBuildRequest(ContractModel):
    session: DesignSessionSchema
    build_id: str = Field(min_length=1)


class CatalogOptionSchema(ContractModel):
    id: str
    brand: str
    model: str
    summary: str
    status: CatalogOptionStatus
    reason: str | None = None
    specs: dict[str, str | float | int] = Field(default_factory=dict)
    unit_price_php: StrictFloat = Field(ge=0)
    unit_price_low_php: StrictFloat = Field(ge=0)
    unit_price_high_php: StrictFloat = Field(ge=0)
    line_total_php: StrictFloat = Field(ge=0)
    line_total_low_php: StrictFloat = Field(ge=0)
    line_total_high_php: StrictFloat = Field(ge=0)
    qty: StrictFloat = Field(gt=0)


class CatalogOptionsRequest(ContractModel):
    session: DesignSessionSchema
    slot: CatalogPickerSlot


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


class ReasoningStepSchema(ContractModel):
    kind: Literal["thinking", "tool_call", "tool_result", "error"]
    label: str
    detail: str | None = None


class AgentDesignResponse(ContractModel):
    session: DesignSessionSchema
    reply: str
    requires_confirmation: StrictBool = False
    planned_actions: tuple[PlannedActionSchema, ...] = ()
    reasoning_steps: tuple[ReasoningStepSchema, ...] = ()


class ExplainDesignRequest(ContractModel):
    session: DesignSessionSchema
    question: str = Field(min_length=1)


class ExplainDesignResponse(ContractModel):
    explanation: str


class QuoteAuditFindingSchema(ContractModel):
    category: str
    severity: Literal["info", "warning", "positive"]
    message: str


QuoteAuditVerdict = Literal["favorable", "caution", "needs_review"]


class QuoteAuditResponseSchema(ContractModel):
    filename: str
    extracted_total_php: StrictFloat | None = None
    extracted_system_kwp: StrictFloat | None = None
    extracted_panel_count: StrictInt | None = Field(default=None, ge=0)
    benchmark_total_php: StrictFloat = Field(ge=0)
    benchmark_system_kwp: StrictFloat = Field(gt=0)
    findings: tuple[QuoteAuditFindingSchema, ...] = ()
    summary: str
    diagram_components: tuple[DesignComponentSchema, ...] = ()
    pros: tuple[str, ...] = ()
    cons: tuple[str, ...] = ()
    questions_for_installer: tuple[str, ...] = ()
    verdict: QuoteAuditVerdict = "needs_review"
