# Defines catalog option listing for partial user builds on the canvas.

from dataclasses import replace

from app.domain.design.catalog import load_catalog
from app.domain.design.compatibility import (
    CatalogOption,
    _picker_qty,
    _price_fields,
    list_catalog_options,
)
from app.domain.design.entities import SolverConstraints
from app.domain.design.rejection import humanize_catalog_rejection
from app.domain.design.solver import _evaluate_combo
from app.features.design.schemas import DesignSessionSchema


def _reference_build(session: DesignSessionSchema):
    active = next(
        (build for build in session.builds if build.id == session.active_build_id),
        session.builds[0],
    )
    ai = next(
        (build for build in session.builds if build.source == "ai_suggested"),
        session.builds[0],
    )
    return active, ai


def _component_id(build, slot: str) -> str | None:
    for component in build.components:
        if component.slot == slot and component.catalog_id:
            return component.catalog_id
    return None


def _list_initial_panel_options(
    *,
    constraints: SolverConstraints,
    valid_combo_ids: set[str],
    best_fit_score: float,
) -> tuple[CatalogOption, ...]:
    cat = load_catalog()
    reference_inverter = None
    for combo_id in valid_combo_ids:
        parts = combo_id.split(":")
        if len(parts) >= 2:
            reference_inverter = parts[1]
            break
    if reference_inverter is None:
        reference_inverter = next(iter(cat.inverters.keys()))
    inverter = cat.inverters[reference_inverter]
    options: list[CatalogOption] = []
    for candidate in cat.panels.values():
        panel_count = max(
            1,
            constraints.seed_panel_count
            or round(constraints.target_kwp * 1000 / candidate.wattage_w),
        )
        combo, rejection = _evaluate_combo(
            candidate,
            inverter,
            None,
            panel_count,
            constraints,
            cat,
            "user-build-panel",
        )
        appears = any(
            combo_id.startswith(f"{candidate.id}:") for combo_id in valid_combo_ids
        )
        if combo is not None and (appears or combo.fit_score >= max(best_fit_score - 3.0, 75.0)):
            status = "recommended"
            reason = None
        elif combo is not None:
            status = "compatible"
            reason = None
        else:
            status = "incompatible"
            reason = humanize_catalog_rejection(rejection, slot="panel")
        options.append(
            CatalogOption(
                id=candidate.id,
                brand=candidate.brand,
                model=candidate.model,
                summary=f"{candidate.wattage_w}W {candidate.brand} panel",
                status=status,
                reason=reason,
                specs={
                    "wattage_w": candidate.wattage_w,
                    "efficiency_pct": candidate.efficiency_pct,
                },
                **_price_fields(
                    candidate.price_php,
                    qty=_picker_qty("panel", panel_count=panel_count),
                ),
            ),
        )
    status_rank = {"selected": 0, "recommended": 1, "compatible": 2, "incompatible": 3}
    options.sort(key=lambda row: (status_rank[row.status], row.brand, row.model))
    return tuple(options)


def _list_initial_inverter_options(
    *,
    panel_id: str | None,
    constraints: SolverConstraints,
    panel_count: int,
    valid_combo_ids: set[str],
    best_fit_score: float,
) -> tuple[CatalogOption, ...]:
    cat = load_catalog()
    if panel_id is None:
        for combo_id in valid_combo_ids:
            parts = combo_id.split(":")
            if len(parts) >= 1:
                panel_id = parts[0]
                break
    if panel_id is None or panel_count <= 0:
        return ()

    panel = cat.panels[panel_id]
    options: list[CatalogOption] = []
    for candidate in cat.inverters.values():
        combo, rejection = _evaluate_combo(
            panel,
            candidate,
            None,
            panel_count,
            constraints,
            cat,
            "user-build-inverter",
        )
        appears = any(f":{candidate.id}:" in combo_id for combo_id in valid_combo_ids)
        if combo is not None and (appears or combo.fit_score >= max(best_fit_score - 3.0, 75.0)):
            status = "recommended"
            reason = None
        elif combo is not None:
            status = "compatible"
            reason = None
        else:
            status = "incompatible"
            reason = humanize_catalog_rejection(rejection, slot="inverter")
        rated_kw = round(candidate.rated_ac_output_w / 1000, 3)
        qty = _picker_qty(
            "inverter",
            panel_count=panel_count,
            candidate_inverter=candidate,
        )
        options.append(
            CatalogOption(
                id=candidate.id,
                brand=candidate.brand,
                model=candidate.model,
                summary=f"{rated_kw} kW {candidate.brand} inverter",
                status=status,
                reason=reason,
                specs={
                    "rated_ac_kw": rated_kw,
                    "mppt_count": candidate.mppt_count,
                },
                **_price_fields(candidate.price_php, qty=qty),
            ),
        )
    status_rank = {"selected": 0, "recommended": 1, "compatible": 2, "incompatible": 3}
    options.sort(key=lambda row: (status_rank[row.status], row.brand, row.model))
    return tuple(options)


def _list_initial_battery_options(
    *,
    panel_id: str | None,
    constraints: SolverConstraints,
    panel_count: int,
    valid_combo_ids: set[str],
    best_fit_score: float,
) -> tuple[CatalogOption, ...]:
    cat = load_catalog()
    if panel_id is None or panel_count <= 0:
        return ()

    panel = cat.panels[panel_id]
    battery_constraints = replace(
        constraints,
        require_battery=True,
        min_battery_kwh=constraints.min_battery_kwh or 3.0,
    )
    options: list[CatalogOption] = []
    for candidate in cat.batteries.values():
        best_combo = None
        best_rejection = None
        for inverter in cat.inverters.values():
            if not inverter.battery_compatible:
                continue
            combo, rejection = _evaluate_combo(
                panel,
                inverter,
                candidate,
                panel_count,
                battery_constraints,
                cat,
                "user-build-battery",
            )
            if combo is not None and (
                best_combo is None or combo.fit_score > best_combo.fit_score
            ):
                best_combo = combo
            elif rejection is not None and best_combo is None:
                best_rejection = rejection

        appears = any(f":{candidate.id}:" in combo_id for combo_id in valid_combo_ids)
        if best_combo is not None and (
            appears or best_combo.fit_score >= max(best_fit_score - 3.0, 75.0)
        ):
            status = "recommended"
            reason = None
        elif best_combo is not None:
            status = "compatible"
            reason = None
        else:
            status = "incompatible"
            reason = humanize_catalog_rejection(best_rejection, slot="battery")
        options.append(
            CatalogOption(
                id=candidate.id,
                brand=candidate.brand,
                model=candidate.model,
                summary=f"{candidate.usable_capacity_kwh} kWh {candidate.brand} battery",
                status=status,
                reason=reason,
                specs={
                    "usable_kwh": candidate.usable_capacity_kwh,
                },
                **_price_fields(
                    candidate.price_php,
                    qty=_picker_qty("battery", panel_count=panel_count),
                ),
            ),
        )
    status_rank = {"selected": 0, "recommended": 1, "compatible": 2, "incompatible": 3}
    options.sort(key=lambda row: (status_rank[row.status], row.brand, row.model))
    return tuple(options)


def get_user_build_catalog_options(
    *,
    session: DesignSessionSchema,
    slot: str,
    constraints: SolverConstraints,
) -> tuple[CatalogOption, ...]:
    if session.last_solve is None:
        return ()

    active, ai = _reference_build(session)
    active_panel_id = _component_id(active, "panel")
    active_inverter_id = _component_id(active, "inverter")
    panel_id = active_panel_id or _component_id(ai, "panel")
    battery_id = _component_id(active, "battery")
    panel_count = active.panel_count or ai.panel_count or 1
    valid_ids = {combo.combo_id for combo in session.last_solve.valid}
    best_fit = max((combo.fit_score for combo in session.last_solve.valid), default=0.0)

    if slot == "panel" and active_panel_id is None:
        return _list_initial_panel_options(
            constraints=constraints,
            valid_combo_ids=valid_ids,
            best_fit_score=best_fit,
        )
    if slot == "inverter" and active_inverter_id is None:
        return _list_initial_inverter_options(
            panel_id=panel_id,
            constraints=constraints,
            panel_count=panel_count,
            valid_combo_ids=valid_ids,
            best_fit_score=best_fit,
        )
    if slot == "battery" and active_inverter_id is None:
        return _list_initial_battery_options(
            panel_id=panel_id,
            constraints=constraints,
            panel_count=panel_count,
            valid_combo_ids=valid_ids,
            best_fit_score=best_fit,
        )

    if panel_id is None or active_inverter_id is None or panel_count <= 0:
        if slot == "panel":
            return _list_initial_panel_options(
                constraints=constraints,
                valid_combo_ids=valid_ids,
                best_fit_score=best_fit,
            )
        if slot == "inverter":
            return _list_initial_inverter_options(
                panel_id=panel_id,
                constraints=constraints,
                panel_count=panel_count,
                valid_combo_ids=valid_ids,
                best_fit_score=best_fit,
            )
        if slot == "battery":
            return _list_initial_battery_options(
                panel_id=panel_id,
                constraints=constraints,
                panel_count=panel_count,
                valid_combo_ids=valid_ids,
                best_fit_score=best_fit,
            )
        return ()

    battery_constraints = constraints
    if slot == "battery":
        battery_constraints = replace(
            constraints,
            require_battery=True,
            min_battery_kwh=constraints.min_battery_kwh or 3.0,
        )

    return list_catalog_options(
        slot=slot,  # type: ignore[arg-type]
        constraints=battery_constraints,
        panel_id=panel_id,
        inverter_id=active_inverter_id,
        battery_id=battery_id,
        panel_count=panel_count,
        valid_combo_ids=valid_ids,
        best_fit_score=best_fit,
    )
