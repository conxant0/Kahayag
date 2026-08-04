# Defines design domain entities shared across solver, BOM, and API layers.

from dataclasses import dataclass, field
from typing import Literal

ComponentSlot = Literal[
    "panel",
    "inverter",
    "battery",
    "protection",
    "structure",
    "electrical",
    "installation",
]

SolverGoal = Literal["auto", "budget", "backup", "independence"]
BuildSource = Literal["ai_suggested", "custom", "user", "uploaded"]


@dataclass(frozen=True)
class PricePhp:
    min: float
    max: float
    as_of: str


@dataclass(frozen=True)
class SolverConstraints:
    target_kwp: float
    max_panel_count: int
    usable_roof_area_m2: float
    budget_php: float | None
    require_battery: bool
    min_battery_kwh: float | None
    goal: SolverGoal
    locked_panel_id: str | None = None
    locked_inverter_id: str | None = None
    locked_battery_id: str | None = None
    panel_count_delta: int | None = None
    annual_consumption_kwh: float = 0.0
    resolved_tariff_php_per_kwh: float = 12.0
    annual_yield_per_kwp_kwh: float = 1400.0


@dataclass(frozen=True)
class RejectionReason:
    combo_key: str
    code: str
    message: str
    details: dict[str, float | str | int] = field(default_factory=dict)


@dataclass(frozen=True)
class ValidCombo:
    combo_id: str
    panel_id: str
    inverter_id: str
    battery_id: str | None
    panel_count: int
    system_kwp: float
    dc_ac_ratio: float
    inverter_utilisation_pct: float
    fit_score: float
    rejection_log_ref: str
    estimated_cost_php: float = 0.0


@dataclass(frozen=True)
class SolveResult:
    solve_id: str
    constraints: SolverConstraints
    valid: tuple[ValidCombo, ...]
    rejections: tuple[RejectionReason, ...]


@dataclass(frozen=True)
class DesignComponent:
    slot: ComponentSlot
    catalog_id: str | None
    brand: str
    model: str
    summary: str
    qty: int | float
    unit: str
    unit_price_php: float
    price_as_of: str | None
    line_total_php: float
    warranty_note: str
    badges: tuple[str, ...] = ()
    specs: dict[str, str | float | int] = field(default_factory=dict)
    product_image: str | None = None


@dataclass(frozen=True)
class DesignBuild:
    id: str
    label: str
    tags: tuple[str, ...]
    combo_id: str
    solve_id: str
    system_kwp: float
    panel_count: int
    inverter_kw: float
    battery_kwh: float | None
    monthly_savings_php: float
    annual_savings_php: float
    payback_years: float | None
    total_investment_php: float
    total_investment_low_php: float
    total_investment_high_php: float
    subtotal_php: float
    vat_php: float
    inverter_utilisation_pct: float
    fit_score: float
    co2_tonnes_avoided_yearly: float
    insight: str
    components: tuple[DesignComponent, ...]
    source: BuildSource


@dataclass(frozen=True)
class AgentAuditEntry:
    turn_id: str
    user_text: str
    tool_calls: tuple[dict[str, object], ...]
    solve_ids: tuple[str, ...]
    final_build_id: str | None


@dataclass(frozen=True)
class DesignSession:
    property_ref: str
    assessment_fingerprint: str
    active_build_id: str
    builds: tuple[DesignBuild, ...]
    last_solve: SolveResult | None
    applied: bool
    agent_audit: tuple[AgentAuditEntry, ...] = ()


@dataclass(frozen=True)
class QuotationLine:
    item: str
    description: str
    brand: str
    uom: str
    qty: float
    unit_price_php: float
    amount_php: float
    price_as_of: str | None = None


@dataclass(frozen=True)
class QuotationDocument:
    build_id: str
    quote_number: str
    quote_date: str
    validity_days: int
    lines: tuple[QuotationLine, ...]
    subtotal_php: float
    vat_php: float
    total_php: float
    payment_terms: str
    warranty_summary: str
    is_draft: bool = True
