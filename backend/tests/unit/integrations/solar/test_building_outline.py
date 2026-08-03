from app.integrations.solar.building_outline import extract_roof_outline


def _segment(area: float, *, south=10.0, west=123.0, size=0.0002, **overrides) -> dict:
    segment = {
        "boundingBox": {
            "sw": {"latitude": south, "longitude": west},
            "ne": {"latitude": south + size, "longitude": west + size},
        },
        "stats": {"areaMeters2": area},
        "pitchDegrees": 15.0,
        "azimuthDegrees": 180.0,
    }
    segment.update(overrides)
    return segment


def _payload(*segments: dict) -> dict:
    return {
        "center": {"latitude": 10.0001, "longitude": 123.0001},
        "boundingBox": {
            "sw": {"latitude": 10.0, "longitude": 123.0},
            "ne": {"latitude": 10.0005, "longitude": 123.0005},
        },
        "solarPotential": {"roofSegmentStats": list(segments)},
    }


def test_reads_the_building_footprint_and_centre() -> None:
    outline = extract_roof_outline(_payload(_segment(40.0)))

    assert outline is not None
    assert outline["bounding_box"] == {
        "south": 10.0,
        "west": 123.0,
        "north": 10.0005,
        "east": 123.0005,
    }
    assert outline["center"] == {"latitude": 10.0001, "longitude": 123.0001}


def test_orders_segments_largest_first() -> None:
    # A caller seeding one outline takes the main roof plane, not whichever the
    # API happened to list first.
    outline = extract_roof_outline(
        _payload(_segment(12.0), _segment(48.0), _segment(30.0))
    )

    assert outline is not None
    areas = [segment["area_square_meters"] for segment in outline["segments"]]
    assert areas == [48.0, 30.0, 12.0]


def test_drops_segments_too_small_to_trace_onto() -> None:
    outline = extract_roof_outline(_payload(_segment(40.0), _segment(1.0)))

    assert outline is not None
    assert len(outline["segments"]) == 1


def test_drops_a_segment_whose_box_is_degenerate() -> None:
    # A box with no extent describes no area, so it cannot seed anything.
    flat = _segment(40.0)
    flat["boundingBox"]["ne"] = flat["boundingBox"]["sw"]

    outline = extract_roof_outline(_payload(flat))

    assert outline is not None
    assert outline["segments"] == []


def test_keeps_pitch_and_azimuth_when_present() -> None:
    outline = extract_roof_outline(_payload(_segment(40.0)))

    assert outline is not None
    assert outline["segments"][0]["pitch_degrees"] == 15.0
    assert outline["segments"][0]["azimuth_degrees"] == 180.0


def test_tolerates_missing_pitch_and_azimuth() -> None:
    segment = _segment(40.0)
    del segment["pitchDegrees"]
    del segment["azimuthDegrees"]

    outline = extract_roof_outline(_payload(segment))

    assert outline is not None
    assert outline["segments"][0]["pitch_degrees"] is None
    assert outline["segments"][0]["azimuth_degrees"] is None


def test_returns_none_when_there_is_no_geometry_at_all() -> None:
    # Reported as "no outline" rather than guessed at.
    assert extract_roof_outline({"solarPotential": {"roofSegmentStats": []}}) is None
    assert extract_roof_outline({}) is None
    assert extract_roof_outline(None) is None
    assert extract_roof_outline("not a payload") is None


def test_survives_a_building_box_without_segments() -> None:
    payload = _payload()
    outline = extract_roof_outline(payload)

    assert outline is not None
    assert outline["bounding_box"] is not None
    assert outline["segments"] == []

