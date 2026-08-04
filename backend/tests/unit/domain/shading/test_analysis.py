# Defines shading analysis unit tests.

from decimal import Decimal

from app.domain.shading.analysis import _clamp_retention_ratio, analyze_building_insights


def test_clamp_retention_ratio_caps_values_above_one() -> None:
    assert _clamp_retention_ratio(Decimal("1.01")) == Decimal("1")
    assert _clamp_retention_ratio(Decimal("0.96")) == Decimal("0.96")


def test_analyze_building_insights_clamps_over_one_retention() -> None:
    analysis = analyze_building_insights(
        latitude=14.5,
        longitude=121.0,
        building_insights={
            "center": {"latitude": 14.5, "longitude": 121.0},
            "solarPotential": {
                "maxSunshineHoursPerYear": 1800,
                "wholeRoofStats": {
                    "areaMeters2": 100,
                    "sunshineQuantiles": [1600, 1700, 1820, 1900],
                },
                "roofSegmentStats": [
                    {
                        "center": {"latitude": 14.5, "longitude": 121.0},
                        "pitchDegrees": 15,
                        "azimuthDegrees": 180,
                        "stats": {
                            "areaMeters2": 50,
                            "sunshineQuantiles": [1650, 1750, 1820, 1900],
                        },
                    }
                ],
            },
        },
    )

    assert analysis.sunshine_retention_ratio <= Decimal("1")
    assert analysis.roof_segments[0].sunshine_retention_ratio <= Decimal("1")
