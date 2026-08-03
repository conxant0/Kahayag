# Defines the optional backend solar-data contract.
from typing import Protocol


class SolarDataProvider(Protocol):
    def find_closest_building_insights(
        self, *, latitude: float, longitude: float
    ) -> dict: ...

    def get_data_layers(
        self, *, latitude: float, longitude: float, radius_meters: int = 100
    ) -> dict: ...
