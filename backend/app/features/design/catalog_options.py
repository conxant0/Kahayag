# Defines catalog option listing for the design canvas component picker.

from dataclasses import replace

from app.domain.design.compatibility import list_catalog_options
from app.features.design.schemas import (
    CatalogOptionSchema,
    CatalogOptionsRequest,
    DesignSessionSchema,
)
from app.features.design.service import _domain_constraints_from_session
from app.features.design.user_catalog_options import get_user_build_catalog_options


def _active_build(session: DesignSessionSchema):
    return next(
        (build for build in session.builds if build.id == session.active_build_id),
        session.builds[0] if session.builds else None,
    )


def _active_component_id(session: DesignSessionSchema, slot: str) -> str | None:
    active = _active_build(session)
    if active is None:
        return None
    for component in active.components:
        if component.slot == slot and component.catalog_id:
            return component.catalog_id
    return None


def _to_catalog_option_schema(option) -> CatalogOptionSchema:
    return CatalogOptionSchema(
        id=option.id,
        brand=option.brand,
        model=option.model,
        summary=option.summary,
        status=option.status,
        reason=option.reason,
        specs=option.specs,
        unit_price_php=option.unit_price_php,
        unit_price_low_php=option.unit_price_low_php,
        unit_price_high_php=option.unit_price_high_php,
        line_total_php=option.line_total_php,
        line_total_low_php=option.line_total_low_php,
        line_total_high_php=option.line_total_high_php,
        qty=option.qty,
    )


def get_catalog_options(request: CatalogOptionsRequest) -> tuple[CatalogOptionSchema, ...]:
    if request.session.last_solve is None:
        return ()

    active = _active_build(request.session)
    if active is None:
        return ()

    domain_constraints = replace(
        _domain_constraints_from_session(
            request.session.last_solve.constraints,
            session=request.session,
        ),
        seed_panel_count=next(
            (
                build.panel_count
                for build in request.session.builds
                if build.source == "ai_suggested" and build.panel_count > 0
            ),
            next(
                (build.panel_count for build in request.session.builds if build.panel_count > 0),
                None,
            ),
        ),
    )

    if active.source == "user":
        options = get_user_build_catalog_options(
            session=request.session,
            slot=request.slot,
            constraints=domain_constraints,
        )
        return tuple(_to_catalog_option_schema(option) for option in options)

    panel_id = _active_component_id(request.session, "panel")
    inverter_id = _active_component_id(request.session, "inverter")
    battery_id = _active_component_id(request.session, "battery")
    panel_count = active.panel_count

    valid_ids = {combo.combo_id for combo in request.session.last_solve.valid}
    best_fit = max((combo.fit_score for combo in request.session.last_solve.valid), default=0.0)

    options = list_catalog_options(
        slot=request.slot,
        constraints=domain_constraints,
        panel_id=panel_id,
        inverter_id=inverter_id,
        battery_id=battery_id,
        panel_count=panel_count,
        valid_combo_ids=valid_ids,
        best_fit_score=best_fit,
    )
    return tuple(_to_catalog_option_schema(option) for option in options)
