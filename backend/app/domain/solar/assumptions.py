# Defines centralized deterministic solar and financial assumptions.

from dataclasses import dataclass
from decimal import Decimal
from types import MappingProxyType
from typing import Literal

PanelCategoryId = Literal["standard-450", "high-output-550"]
DEFAULT_PANEL_CATEGORY_ID: PanelCategoryId = "standard-450"


@dataclass(frozen=True)
class PanelCategory:
    id: PanelCategoryId
    wattage_w: int
    width_m: Decimal
    height_m: Decimal

    @property
    def area_m2(self) -> Decimal:
        return self.width_m * self.height_m


_PANEL_WIDTH_M = Decimal("1.13")
_PANEL_HEIGHT_M = Decimal("1.76")

PANEL_CATEGORIES = MappingProxyType(
    {
        "standard-450": PanelCategory(
            id="standard-450",
            wattage_w=450,
            width_m=_PANEL_WIDTH_M,
            height_m=_PANEL_HEIGHT_M,
        ),
        "high-output-550": PanelCategory(
            id="high-output-550",
            wattage_w=550,
            width_m=_PANEL_WIDTH_M,
            height_m=_PANEL_HEIGHT_M,
        ),
    }
)

DEFAULT_ELECTRICITY_RATE_PHP_PER_KWH = Decimal("12.00")

PEAK_SUN_HOURS_PER_DAY = Decimal("5.0")
PERFORMANCE_RATIO = Decimal("0.80")

COST_LOW_PHP_PER_KWP = 50_000
COST_BASE_PHP_PER_KWP = 60_000
COST_HIGH_PHP_PER_KWP = 70_000

COST_INCLUSIONS = ("Solar panels", "Inverter", "Standard installation")
POTENTIAL_EXCLUSIONS = ("Roof repairs", "Electrical upgrades", "Permits")
LIMITATIONS = (
    "This result is a preliminary pre-feasibility estimate.",
    "A licensed solar professional must verify the final design and quotation.",
)
