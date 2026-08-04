# Defines rejection reason helpers for the design constraint solver.

from app.domain.design.entities import RejectionReason


def make_rejection(
    combo_key: str,
    code: str,
    message: str,
    **details: float | str,
) -> RejectionReason:
    return RejectionReason(
        combo_key=combo_key,
        code=code,
        message=message,
        details=dict(details),
    )


def combo_key(
    panel_id: str,
    inverter_id: str,
    battery_id: str | None,
    panel_count: int,
) -> str:
    battery_part = battery_id or "none"
    return f"{panel_id}:{inverter_id}:{battery_part}:{panel_count}"


def filter_rejections_for_combo(
    rejections: tuple[RejectionReason, ...],
    combo_key_value: str,
) -> tuple[RejectionReason, ...]:
    return tuple(r for r in rejections if r.combo_key == combo_key_value)
