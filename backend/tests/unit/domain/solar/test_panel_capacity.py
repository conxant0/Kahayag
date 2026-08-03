from decimal import Decimal

import pytest

from app.domain.solar.geometry import max_panels_by_roof


@pytest.mark.parametrize(
    ("usable_area_m2", "panel_area_m2", "expected"),
    [
        (Decimal("1.9887"), Decimal("1.9888"), 0),
        (Decimal("1.9888"), Decimal("1.9888"), 1),
        (Decimal("3.9775"), Decimal("1.9888"), 1),
        (Decimal("3.9776"), Decimal("1.9888"), 2),
        (Decimal("32.00"), Decimal("1.9888"), 16),
        (Decimal("32.00"), Decimal("2.50"), 12),
        (Decimal("1000.00"), Decimal("1.9888"), 502),
    ],
    ids=[
        "small-below-one",
        "exactly-one",
        "just-below-two",
        "exactly-two",
        "typical",
        "different-panel-area",
        "large",
    ],
)
def test_max_panels_by_roof_uses_supplied_panel_area(
    usable_area_m2: Decimal,
    panel_area_m2: Decimal,
    expected: int,
) -> None:
    assert max_panels_by_roof(usable_area_m2, panel_area_m2) == expected
