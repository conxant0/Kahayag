# Defines rejection reason helpers for the design constraint solver.

import re
from typing import Literal

from app.domain.design.constants import DC_AC_RATIO_MIN
from app.domain.design.entities import RejectionReason

CatalogPickerSlot = Literal["panel", "inverter", "battery"]

_MPPT_MESSAGE_MAP = {
    "panel Voc exceeds inverter MPPT maximum": "Panel voltage is too high for this inverter.",
    "no valid series string length for MPPT window": (
        "These panels can't be wired to match this inverter's voltage range."
    ),
    "cannot form valid string within MPPT voltage window": (
        "These panels can't be wired correctly for this inverter."
    ),
    "Single-panel voltage outside microinverter MPPT window": (
        "Panel voltage is outside this microinverter's operating range."
    ),
}


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


def humanize_catalog_rejection(
    rejection: RejectionReason | None,
    *,
    slot: CatalogPickerSlot,
) -> str:
    if rejection is None:
        return "This part doesn't work with the rest of your build."

    code = rejection.code
    details = rejection.details

    if code == "dc_ac_oversizing":
        ratio = float(details["dc_ac_ratio"]) if "dc_ac_ratio" in details else None
        min_ratio = float(details.get("min_ratio", DC_AC_RATIO_MIN))
        too_few = ratio is not None and ratio < min_ratio
        if slot == "battery":
            return (
                "Your panel count doesn't pair with any hybrid inverter "
                "that supports this battery."
            )
        if slot == "panel":
            if too_few:
                return (
                    "Too few of these panels for your inverter — "
                    "add more panels or choose a smaller inverter."
                )
            return (
                "Too many of these panels for your inverter — "
                "use fewer panels or choose a larger inverter."
            )
        if too_few:
            return (
                "This inverter is oversized for your panels — "
                "add more panels or choose a smaller inverter."
            )
        return (
            "This inverter is undersized for your panels — "
            "use fewer panels or choose a larger inverter."
        )

    if code == "battery_compat":
        if slot == "battery" and "Battery" in rejection.message and "not certified" in rejection.message:
            return "This battery isn't approved for your selected inverter."
        if slot == "battery":
            return (
                "Pick a hybrid (battery-ready) inverter first, "
                "or choose a different battery."
            )
        if slot == "inverter":
            return (
                "This is a grid-tie inverter — it can't connect to a battery. "
                "Choose a hybrid model."
            )
        return "This inverter can't connect to a battery."

    if code == "panel_inverter_compat":
        if slot == "panel":
            return "This panel isn't certified to work with your selected inverter."
        if slot == "inverter":
            return "This inverter isn't certified to work with your selected panels."
        return "These panels and inverter aren't certified to work together."

    if code == "mppt_voltage":
        mapped = _MPPT_MESSAGE_MAP.get(rejection.message)
        if mapped:
            return mapped
        match = re.match(r"need at least (\d+) panels", rejection.message)
        if match:
            count = match.group(1)
            return f"Need at least {count} panels for this inverter's voltage range."
        return "Panel voltage doesn't match this inverter's operating range."

    if code == "input_current":
        return "This panel draws more current than the inverter can handle."

    if code == "roof_area":
        usable = details.get("usable_m2")
        if usable is not None:
            return f"Needs more roof space than you have available ({float(usable):.0f} m² usable)."
        return "Needs more roof space than you have available."

    if code == "max_panel_count":
        maximum = details.get("max_panel_count")
        if maximum is not None:
            return f"Exceeds the maximum panel count for your roof ({int(maximum)} panels)."
        return "Exceeds the maximum panel count for your roof."

    if code == "budget":
        budget = details.get("budget_php")
        if budget is not None:
            return f"Estimated cost exceeds your budget (₱{float(budget):,.0f})."
        return "Estimated cost exceeds your budget."

    if code == "battery_capacity":
        minimum = details.get("min_kwh")
        if minimum is not None:
            return f"Capacity is below the {float(minimum):g} kWh minimum for backup."
        return "Capacity is below the minimum needed for backup."

    if code == "battery_required":
        return "A battery is required for this design goal."

    if code.startswith("locked_"):
        return "This design is locked to a different part."

    return "This part doesn't work with the rest of your build."
