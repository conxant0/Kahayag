# Defines solar-domain errors.


class RoofGeometryError(ValueError):
    """Base error for a roof polygon that fails deterministic geometry rules."""


class SelfIntersectingRoofPolygonError(RoofGeometryError):
    """Raised when a roof polygon's edges cross themselves (e.g. a bowtie shape)."""


class DegenerateRoofPolygonError(RoofGeometryError):
    """Raised when a roof polygon encloses no usable area (collinear or duplicate vertices)."""


class InsufficientRoofAreaError(RoofGeometryError):
    """Raised when a valid roof polygon is too small to plausibly fit any solar panel."""


class NoFeasibleSystemError(ValueError):
    """Raised when no standard panel category fits the roof area or budget."""
