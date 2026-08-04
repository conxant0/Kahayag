# Defines catalog option listing for the design canvas component picker.

from app.domain.design.compatibility import list_catalog_options
from app.features.design.schemas import (
    CatalogOptionSchema,
    CatalogOptionsRequest,
    DesignSessionSchema,
)
from app.features.design.service import _domain_constraints_from_session


def _active_component_id(session: DesignSessionSchema, slot: str) -> str | None:
    active = next(
        (build for build in session.builds if build.id == session.active_build_id),
        session.builds[0] if session.builds else None,
    )
    if active is None:
        return None
    for component in active.components:
        if component.slot == slot and component.catalog_id:
            return component.catalog_id
    return None


def get_catalog_options(request: CatalogOptionsRequest) -> tuple[CatalogOptionSchema, ...]:
    if request.session.last_solve is None:
        return ()

    active = next(
        (build for build in request.session.builds if build.id == request.session.active_build_id),
        request.session.builds[0] if request.session.builds else None,
    )
    if active is None:
        return ()

    panel_id = _active_component_id(request.session, "panel")
    inverter_id = _active_component_id(request.session, "inverter")
    battery_id = _active_component_id(request.session, "battery")
    panel_count = active.panel_count

    valid_ids = {combo.combo_id for combo in request.session.last_solve.valid}
    best_fit = max((combo.fit_score for combo in request.session.last_solve.valid), default=0.0)

    constraints = _domain_constraints_from_session(
        request.session.last_solve.constraints,
        session=request.session,
    )

    options = list_catalog_options(
        slot=request.slot,
        constraints=constraints,
        panel_id=panel_id,
        inverter_id=inverter_id,
        battery_id=battery_id,
        panel_count=panel_count,
        valid_combo_ids=valid_ids,
        best_fit_score=best_fit,
    )
    return tuple(
        CatalogOptionSchema(
            id=option.id,
            brand=option.brand,
            model=option.model,
            summary=option.summary,
            status=option.status,
            reason=option.reason,
            specs=option.specs,
        )
        for option in options
    )
