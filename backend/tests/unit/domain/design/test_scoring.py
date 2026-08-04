# Defines fit-score and alternate-selection unit tests.

from app.domain.design.entities import ValidCombo
from app.domain.design.scoring import pick_alternate_combo


def _combo(
    *,
    panel_id: str,
    inverter_id: str,
    battery_id: str | None,
    panel_count: int,
    fit_score: float,
) -> ValidCombo:
    battery_part = battery_id or "none"
    return ValidCombo(
        combo_id=f"{panel_id}:{inverter_id}:{battery_part}:{panel_count}",
        panel_id=panel_id,
        inverter_id=inverter_id,
        battery_id=battery_id,
        panel_count=panel_count,
        system_kwp=panel_count * 0.45,
        dc_ac_ratio=1.2,
        inverter_utilisation_pct=90.0,
        fit_score=fit_score,
        rejection_log_ref="test",
        estimated_cost_php=100_000.0,
    )


def test_pick_alternate_combo_skips_same_equipment_stack() -> None:
    top = _combo(
        panel_id="panel_001",
        inverter_id="inv_001",
        battery_id=None,
        panel_count=10,
        fit_score=95.0,
    )
    near_duplicate = _combo(
        panel_id="panel_001",
        inverter_id="inv_001",
        battery_id=None,
        panel_count=11,
        fit_score=94.5,
    )
    distinct = _combo(
        panel_id="panel_002",
        inverter_id="inv_001",
        battery_id=None,
        panel_count=10,
        fit_score=94.0,
    )

    picked = pick_alternate_combo(top, (top, near_duplicate, distinct))

    assert picked == distinct


def test_pick_alternate_combo_returns_none_without_distinct_option() -> None:
    top = _combo(
        panel_id="panel_001",
        inverter_id="inv_001",
        battery_id=None,
        panel_count=10,
        fit_score=95.0,
    )
    near_duplicate = _combo(
        panel_id="panel_001",
        inverter_id="inv_001",
        battery_id=None,
        panel_count=11,
        fit_score=94.5,
    )

    assert pick_alternate_combo(top, (top, near_duplicate)) is None
