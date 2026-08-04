# Defines one-off catalog expansion for PH-market solar component coverage.
# Run from backend/: .venv/bin/python scripts/expand_solar_catalog.py

from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any

CATALOG_PATH = Path(__file__).resolve().parents[1] / "app" / "data" / "solar_components_catalog.json"
AS_OF = "2026-07-01"
CURRENCY_NOTE = (
    "component cost largely USD-pegged; PHP price may shift with exchange rate"
)


def _price(min_php: int, max_php: int) -> dict[str, Any]:
    return {
        "min": min_php,
        "max": max_php,
        "as_of": AS_OF,
        "currency_note": CURRENCY_NOTE,
    }


def _panel_base(
    panel_id: str,
    *,
    brand: str,
    model: str,
    wattage_w: int,
    sku: str,
    distributor: str,
    price_min: int,
    price_max: int,
    voc_v: float = 41.5,
    vmp_v: float = 34.8,
    imp_a: float = 12.65,
    isc_a: float = 13.5,
    efficiency_pct: float = 22.3,
    length_mm: int = 1909,
    width_mm: int = 1134,
    weight_kg: float = 22.5,
    cell_technology: str = "PERC",
    panel_type: str = "monocrystalline",
    application: str = "residential",
    availability: str = "in_stock",
    website: str,
) -> dict[str, Any]:
    return {
        "id": panel_id,
        "brand": brand,
        "model": model,
        "type": panel_type,
        "wattage_w": wattage_w,
        "voc_v": voc_v,
        "vmp_v": vmp_v,
        "isc_a": isc_a,
        "imp_a": imp_a,
        "efficiency_pct": efficiency_pct,
        "temperature_coefficient_pmax_pct_per_c": -0.34,
        "noct_c": 45,
        "dimensions_mm": {"length": length_mm, "width": width_mm, "depth": 30},
        "weight_kg": weight_kg,
        "cells": 108 if wattage_w <= 480 else 144,
        "connector_type": "MC4",
        "wind_load_rating_pa": {"front": 5400, "back": 2400},
        "salt_mist_certified": True,
        "ip_rating_junction_box": "IP68",
        "certifications": ["IEC61215", "IEC61730", "IEC61701"],
        "warranty": {
            "product_years": 15,
            "performance_years": 25,
            "performance_curve": "98% year 1, linear to 84% year 25",
            "voids_warranty_if": [
                "exceeds inverter max input current per MPPT",
                "improper grounding/installation not by certified installer",
                "physical damage from non-rated wind/hail exposure",
            ],
        },
        "price_php": _price(price_min, price_max),
        "stock_lead_time_days": {
            "min": 3,
            "max": 21,
            "note": "widely stocked via PH distributors and installer networks",
        },
        "local_service_network": "wide (multiple PH distributors)",
        "certified_compatible_inverters": [],
        "source": "manufacturer_datasheet",
        "cell_technology": cell_technology,
        "bifacial": False,
        "power_tolerance_w": {"min": 0, "max": 5},
        "fire_rating": "IEC 61730 Class C",
        "maximum_system_voltage_v": 1500,
        "maximum_series_fuse_rating_a": 25,
        "panel_color": "black",
        "frame_color": "black anodized aluminum",
        "manufacturer_country": "China",
        "degradation_rate": {"year_1_pct": 2.0, "annual_pct": 0.55},
        "application": application,
        "sku": sku,
        "distributor": distributor,
        "availability_status": availability,
        "product_release_year": 2023,
        "country_of_origin": "China",
        "manufacturer_website": website,
        "product_image": f"https://assets.kahayag.dev/catalog/panels/{panel_id}.jpg",
        "datasheet_pdf_url": f"https://assets.kahayag.dev/catalog/panels/{panel_id}_datasheet.pdf",
        "installation_manual_url": f"https://assets.kahayag.dev/catalog/panels/{panel_id}_install.pdf",
        "last_updated": AS_OF,
        "eol_status": "active",
    }


def _inverter_base(
    inv_id: str,
    *,
    brand: str,
    model: str,
    inv_type: str,
    ac_w: int,
    dc_w: int,
    sku: str,
    distributor: str,
    price_min: int,
    price_max: int,
    battery_compatible: bool = False,
    certified_batteries: list[str] | None = None,
    mppt_min: int = 80,
    mppt_max: int = 550,
    mppt_count: int = 2,
    mppt_current: float = 13.5,
    backup_eps: bool = False,
    website: str,
) -> dict[str, Any]:
    entry: dict[str, Any] = {
        "id": inv_id,
        "brand": brand,
        "model": model,
        "type": inv_type,
        "rated_ac_output_w": ac_w,
        "max_dc_input_w": dc_w,
        "mppt_count": mppt_count,
        "mppt_voltage_range_v": {"min": mppt_min, "max": mppt_max},
        "max_input_current_per_mppt_a": mppt_current,
        "cec_euro_efficiency_pct": 97.6,
        "standby_power_draw_w": 2 if not battery_compatible else 3,
        "ip_rating": "IP65",
        "cooling_type": "fan-cooled" if battery_compatible else "natural convection",
        "connector_type": "MC4",
        "battery_compatible": battery_compatible,
        "meralco_net_metering_approved": True,
        "warranty": {
            "years": 10,
            "extendable_to_years": 15,
            "voids_warranty_if": [
                "input voltage/current exceeds rated MPPT range",
                "grid connection made without utility-approved net metering setup",
            ],
        },
        "price_php": _price(price_min, price_max),
        "stock_lead_time_days": {
            "min": 3,
            "max": 21,
            "note": "common in PH residential turnkey packages",
        },
        "local_service_network": "wide",
        "source": "distributor_listing",
        "phase": "single_phase",
        "maximum_efficiency_pct": 98.0,
        "startup_voltage_v": mppt_min,
        "max_pv_strings": 4,
        "connectivity": {"wifi": True, "ethernet": False, "bluetooth": False},
        "monitoring_platform": f"{brand} Cloud",
        "backup_eps_capable": backup_eps,
        "generator_compatible": backup_eps,
        "operating_temp_range_c": {"min": -25, "max": 60},
        "noise_level_db": 35 if battery_compatible else None,
        "country_of_manufacture": "China",
        "application": "residential",
        "sku": sku,
        "distributor": distributor,
        "availability_status": "in_stock",
        "product_release_year": 2023,
        "country_of_origin": "China",
        "manufacturer_website": website,
        "product_image": f"https://assets.kahayag.dev/catalog/inverters/{inv_id}.jpg",
        "datasheet_pdf_url": f"https://assets.kahayag.dev/catalog/inverters/{inv_id}_datasheet.pdf",
        "installation_manual_url": f"https://assets.kahayag.dev/catalog/inverters/{inv_id}_install.pdf",
        "last_updated": AS_OF,
        "eol_status": "active",
    }
    if battery_compatible:
        entry["battery_voltage_v"] = 48
        entry["certified_batteries"] = certified_batteries or []
        entry["eps_output_w"] = ac_w
    return entry


def _battery_base(
    batt_id: str,
    *,
    brand: str,
    model: str,
    usable_kwh: float,
    capacity_kwh: float,
    sku: str,
    distributor: str,
    price_min: int,
    price_max: int,
    charge_kw: float,
    discharge_kw: float,
    recommended_brands: list[str],
    website: str,
) -> dict[str, Any]:
    return {
        "id": batt_id,
        "brand": brand,
        "model": model,
        "chemistry": "LiFePO4",
        "capacity_kwh": capacity_kwh,
        "usable_capacity_kwh": usable_kwh,
        "depth_of_discharge_pct": 90,
        "voltage_v": 48,
        "max_charge_rate_kw": charge_kw,
        "max_discharge_rate_kw": discharge_kw,
        "cycle_life": 6000,
        "calendar_life_years": 10,
        "operating_temp_range_c": {
            "min": 0,
            "max": 50,
            "note": "typical indoor/garage install in PH climate",
        },
        "ip_rating": "IP65",
        "warranty": {
            "years": 10,
            "cycles": 6000,
            "whichever_first": True,
            "voids_warranty_if": [
                "paired with non-certified inverter",
                "operated outside rated temperature range",
                "discharged beyond rated DoD repeatedly",
            ],
        },
        "price_php": _price(price_min, price_max),
        "stock_lead_time_days": {
            "min": 7,
            "max": 30,
            "note": "battery import lead times vary by distributor",
        },
        "local_service_network": "moderate",
        "source": "distributor_listing",
        "max_continuous_output_power_kw": discharge_kw,
        "peak_output_power_kw": round(discharge_kw * 1.4, 1),
        "round_trip_efficiency_pct": 94.5,
        "battery_management_system": {
            "integrated": True,
            "description": "Integrated BMS with CAN/RS485 communication",
        },
        "expandable_stackable": True,
        "max_modules": 16,
        "communication_protocols": ["CAN", "RS485"],
        "dimensions_mm": {"height": 650, "width": 450, "depth": 170},
        "weight_kg": 50,
        "installation_type": "wall_mounted",
        "manufacturer_country": "China",
        "recommended_inverter_brands": recommended_brands,
        "sku": sku,
        "distributor": distributor,
        "availability_status": "in_stock",
        "product_release_year": 2023,
        "country_of_origin": "China",
        "manufacturer_website": website,
        "product_image": f"https://assets.kahayag.dev/catalog/batteries/{batt_id}.jpg",
        "datasheet_pdf_url": f"https://assets.kahayag.dev/catalog/batteries/{batt_id}_datasheet.pdf",
        "installation_manual_url": f"https://assets.kahayag.dev/catalog/batteries/{batt_id}_install.pdf",
        "last_updated": AS_OF,
        "eol_status": "active",
    }


NEW_PANELS: list[dict[str, Any]] = [
    _panel_base(
        "panel_009",
        brand="JA Solar",
        model="DeepBlue 3.0 JAM54S30-450/MR",
        wattage_w=450,
        sku="JAM54S30-450/MR",
        distributor="PHILERGY, Greenergy Solar",
        price_min=5700,
        price_max=7100,
        website="https://www.jasolar.com",
    ),
    _panel_base(
        "panel_010",
        brand="Risen Energy",
        model="Titan S RSM110-8-450M",
        wattage_w=450,
        sku="RSM110-8-450M",
        distributor="Solgen Trading, regional installers",
        price_min=5400,
        price_max=6800,
        website="https://www.risenenergy.com",
    ),
    _panel_base(
        "panel_011",
        brand="Astronergy",
        model="CHSM54N-HC-455",
        wattage_w=455,
        sku="CHSM54N-HC-455",
        distributor="Truelight Energy, Meralco MServe partners",
        price_min=5800,
        price_max=7200,
        website="https://www.astronergy.com",
    ),
    _panel_base(
        "panel_012",
        brand="Seraphim",
        model="S5 Series SRP-450-BMD-HV",
        wattage_w=450,
        sku="SRP-450-BMD-HV",
        distributor="Solaric Corp., provincial distributors",
        price_min=5500,
        price_max=6900,
        website="https://www.seraphim-energy.com",
    ),
    _panel_base(
        "panel_013",
        brand="Qcells",
        model="Q.PEAK DUO BLK ML-G10+ 420",
        wattage_w=420,
        sku="Q.PEAK-DUO-BLK-420",
        distributor="Premium PH installers",
        price_min=6200,
        price_max=7600,
        voc_v=40.8,
        vmp_v=34.2,
        imp_a=12.28,
        efficiency_pct=21.4,
        length_mm=1879,
        website="https://www.qcells.com",
    ),
    _panel_base(
        "panel_014",
        brand="TW Solar",
        model="TW450M-54H",
        wattage_w=450,
        sku="TW450M-54H",
        distributor="Budget turnkey installers, online PH retailers",
        price_min=4800,
        price_max=6200,
        website="https://www.tw-solar.com",
    ),
    _panel_base(
        "panel_015",
        brand="Phono Solar",
        model="TwinPlus M10-54-450W",
        wattage_w=450,
        sku="PS450M-54H",
        distributor="Regional Visayas/Mindanao distributors",
        price_min=5200,
        price_max=6600,
        website="https://www.phono-solar.com",
    ),
    _panel_base(
        "panel_016",
        brand="LONGi",
        model="Hi-MO X6 LR5-72HTH-545M",
        wattage_w=545,
        sku="LR5-72HTH-545M",
        distributor="Solgen Trading, Solaric Corp.",
        price_min=7200,
        price_max=8800,
        voc_v=49.5,
        vmp_v=41.6,
        imp_a=13.1,
        length_mm=2278,
        weight_kg=27.0,
        cell_technology="HPBC",
        website="https://www.longi.com",
    ),
    _panel_base(
        "panel_017",
        brand="Jinko Solar",
        model="Tiger Neo N-Type 585W",
        wattage_w=585,
        sku="JKM585N-72HL4-V",
        distributor="PHILERGY, Truelight Energy",
        price_min=7800,
        price_max=9500,
        voc_v=52.1,
        vmp_v=43.5,
        imp_a=13.45,
        length_mm=2278,
        weight_kg=28.5,
        cell_technology="TOPCon",
        panel_type="monocrystalline_ntype",
        website="https://www.jinkosolar.com",
    ),
    _panel_base(
        "panel_018",
        brand="Hanwha Qcells",
        model="Q.MAXX-G2 400",
        wattage_w=400,
        sku="Q.MAXX-G2-400",
        distributor="Metro Manila townhouse installers",
        price_min=5000,
        price_max=6400,
        voc_v=39.8,
        vmp_v=33.4,
        imp_a=11.98,
        efficiency_pct=20.9,
        length_mm=1722,
        width_mm=1134,
        weight_kg=20.5,
        website="https://www.qcells.com",
    ),
    _panel_base(
        "panel_019",
        brand="Canadian Solar",
        model="TOPHiKu7 CS7N-625MS",
        wattage_w=625,
        sku="CS7N-625MS",
        distributor="Commercial/residential crossover distributors",
        price_min=9000,
        price_max=11000,
        voc_v=53.8,
        vmp_v=44.9,
        imp_a=13.92,
        length_mm=2384,
        width_mm=1134,
        weight_kg=31.0,
        cell_technology="TOPCon",
        application="residential_commercial",
        website="https://www.canadiansolar.com",
    ),
    _panel_base(
        "panel_020",
        brand="AE Solar",
        model="AE450-54MHBD",
        wattage_w=450,
        sku="AE450-54MHBD",
        distributor="Value-tier provincial bundles",
        price_min=4600,
        price_max=6000,
        website="https://www.ae-solar.com",
    ),
]

NEW_INVERTERS: list[dict[str, Any]] = [
    _inverter_base(
        "inv_011",
        brand="Growatt",
        model="MIN 3000TL-X",
        inv_type="grid_tie",
        ac_w=3000,
        dc_w=4500,
        sku="MIN3000TL-X",
        distributor="Growatt PH authorized distributors",
        price_min=18000,
        price_max=24000,
        website="https://www.growatt.com",
    ),
    _inverter_base(
        "inv_012",
        brand="Growatt",
        model="MIN 4000TL-X",
        inv_type="grid_tie",
        ac_w=4000,
        dc_w=6000,
        sku="MIN4000TL-X",
        distributor="Growatt PH authorized distributors",
        price_min=22000,
        price_max=28000,
        website="https://www.growatt.com",
    ),
    _inverter_base(
        "inv_013",
        brand="GoodWe",
        model="GW3000-DNS-30",
        inv_type="grid_tie",
        ac_w=3000,
        dc_w=4500,
        sku="GW3000-DNS-30",
        distributor="GoodWe PH distributors",
        price_min=17000,
        price_max=23000,
        website="https://www.goodwe.com",
    ),
    _inverter_base(
        "inv_014",
        brand="GoodWe",
        model="GW4000-DNS-30",
        inv_type="grid_tie",
        ac_w=4000,
        dc_w=6000,
        sku="GW4000-DNS-30",
        distributor="GoodWe PH distributors",
        price_min=21000,
        price_max=27000,
        website="https://www.goodwe.com",
    ),
    _inverter_base(
        "inv_015",
        brand="Solis",
        model="S5-GR1P3K",
        inv_type="grid_tie",
        ac_w=3000,
        dc_w=4500,
        sku="S5-GR1P3K",
        distributor="Solis PH distributors",
        price_min=16000,
        price_max=22000,
        website="https://www.solisinverters.com",
    ),
    _inverter_base(
        "inv_016",
        brand="Solis",
        model="S5-GR1P4K",
        inv_type="grid_tie",
        ac_w=4000,
        dc_w=6000,
        sku="S5-GR1P4K",
        distributor="Solis PH distributors",
        price_min=20000,
        price_max=26000,
        website="https://www.solisinverters.com",
    ),
    _inverter_base(
        "inv_017",
        brand="Sungrow",
        model="SG3.0RS",
        inv_type="grid_tie",
        ac_w=3000,
        dc_w=4500,
        sku="SG3.0RS",
        distributor="Sungrow PH distributors",
        price_min=19000,
        price_max=25000,
        mppt_current=15.0,
        website="https://www.sungrowpower.com",
    ),
    _inverter_base(
        "inv_018",
        brand="Sungrow",
        model="SG4.0RS",
        inv_type="grid_tie",
        ac_w=4000,
        dc_w=6000,
        sku="SG4.0RS",
        distributor="Sungrow PH distributors",
        price_min=23000,
        price_max=29000,
        mppt_current=15.0,
        website="https://www.sungrowpower.com",
    ),
    _inverter_base(
        "inv_019",
        brand="Deye",
        model="SUN-3K-SG04LP1-EU (Hybrid)",
        inv_type="hybrid",
        ac_w=3000,
        dc_w=4680,
        sku="SUN-3K-SG04LP1-EU",
        distributor="Deye PH distributors",
        price_min=42000,
        price_max=52000,
        battery_compatible=True,
        certified_batteries=["batt_001", "batt_002", "batt_006", "batt_009", "batt_012"],
        backup_eps=True,
        website="https://www.deyeinverter.com",
    ),
    _inverter_base(
        "inv_020",
        brand="Deye",
        model="SUN-4K-SG04LP1-EU (Hybrid)",
        inv_type="hybrid",
        ac_w=4000,
        dc_w=6240,
        sku="SUN-4K-SG04LP1-EU",
        distributor="Deye PH distributors",
        price_min=48000,
        price_max=58000,
        battery_compatible=True,
        certified_batteries=["batt_001", "batt_002", "batt_006", "batt_009", "batt_012"],
        backup_eps=True,
        website="https://www.deyeinverter.com",
    ),
    _inverter_base(
        "inv_021",
        brand="Growatt",
        model="SPH 3000 TL BL-UP (Hybrid)",
        inv_type="hybrid",
        ac_w=3000,
        dc_w=4500,
        sku="SPH3000TL-BL-UP",
        distributor="Growatt PH authorized distributors",
        price_min=40000,
        price_max=50000,
        battery_compatible=True,
        certified_batteries=["batt_002", "batt_003", "batt_010", "batt_012"],
        backup_eps=True,
        website="https://www.growatt.com",
    ),
    _inverter_base(
        "inv_022",
        brand="Growatt",
        model="SPH 4000 TL BL-UP (Hybrid)",
        inv_type="hybrid",
        ac_w=4000,
        dc_w=6000,
        sku="SPH4000TL-BL-UP",
        distributor="Growatt PH authorized distributors",
        price_min=46000,
        price_max=56000,
        battery_compatible=True,
        certified_batteries=["batt_002", "batt_003", "batt_010", "batt_012"],
        backup_eps=True,
        website="https://www.growatt.com",
    ),
    _inverter_base(
        "inv_023",
        brand="Huawei",
        model="SUN2000-3KTL-L1 (Hybrid)",
        inv_type="hybrid",
        ac_w=3000,
        dc_w=4500,
        sku="SUN2000-3KTL-L1",
        distributor="Huawei FusionSolar partners",
        price_min=58000,
        price_max=68000,
        mppt_min=140,
        battery_compatible=True,
        certified_batteries=["batt_005", "batt_013"],
        backup_eps=True,
        website="https://solar.huawei.com",
    ),
    _inverter_base(
        "inv_024",
        brand="Huawei",
        model="SUN2000-4KTL-L1 (Hybrid)",
        inv_type="hybrid",
        ac_w=4000,
        dc_w=6000,
        sku="SUN2000-4KTL-L1",
        distributor="Huawei FusionSolar partners",
        price_min=64000,
        price_max=76000,
        mppt_min=140,
        battery_compatible=True,
        certified_batteries=["batt_005", "batt_013"],
        backup_eps=True,
        website="https://solar.huawei.com",
    ),
    _inverter_base(
        "inv_025",
        brand="Huawei",
        model="SUN2000-8KTL-M1",
        inv_type="grid_tie",
        ac_w=8000,
        dc_w=12000,
        sku="SUN2000-8KTL-M1",
        distributor="Huawei FusionSolar partners",
        price_min=78000,
        price_max=92000,
        mppt_min=140,
        mppt_current=12.5,
        website="https://solar.huawei.com",
    ),
    _inverter_base(
        "inv_026",
        brand="SMA",
        model="Sunny Boy 3.0",
        inv_type="grid_tie",
        ac_w=3000,
        dc_w=4500,
        sku="SB3.0-1AV-41",
        distributor="SMA authorized PH dealers",
        price_min=72000,
        price_max=85000,
        mppt_max=600,
        website="https://www.sma.de",
    ),
    _inverter_base(
        "inv_027",
        brand="Hoymiles",
        model="HM-800 Microinverter",
        inv_type="microinverter",
        ac_w=800,
        dc_w=1100,
        sku="HM-800-4T",
        distributor="Hoymiles certified PH installers",
        price_min=9000,
        price_max=12000,
        mppt_count=1,
        mppt_min=16,
        mppt_max=60,
        mppt_current=14.0,
        website="https://www.hoymiles.com",
    ),
    _inverter_base(
        "inv_028",
        brand="Enphase",
        model="IQ8P Microinverter",
        inv_type="microinverter",
        ac_w=384,
        dc_w=460,
        sku="IQ8P-72-M-US",
        distributor="Enphase certified PH installers",
        price_min=15000,
        price_max=19000,
        mppt_count=1,
        mppt_min=24,
        mppt_max=58,
        mppt_current=14.0,
        battery_compatible=True,
        certified_batteries=["batt_005", "batt_014"],
        website="https://enphase.com",
    ),
]

NEW_BATTERIES: list[dict[str, Any]] = [
    _battery_base(
        "batt_007",
        brand="Pylontech",
        model="Force H2 (10.65 kWh stack)",
        usable_kwh=9.5,
        capacity_kwh=10.65,
        sku="Force-H2",
        distributor="Pylontech PH distributors, Greenergy Solar",
        price_min=185000,
        price_max=220000,
        charge_kw=5.0,
        discharge_kw=5.0,
        recommended_brands=["Growatt", "Deye", "GoodWe"],
        website="https://www.pylontech.com.cn",
    ),
    _battery_base(
        "batt_008",
        brand="Pylontech",
        model="US3000C",
        usable_kwh=3.55,
        capacity_kwh=3.55,
        sku="US3000C",
        distributor="Pylontech PH distributors",
        price_min=65000,
        price_max=78000,
        charge_kw=2.4,
        discharge_kw=3.55,
        recommended_brands=["Growatt", "Deye", "GoodWe", "Victron"],
        website="https://www.pylontech.com.cn",
    ),
    _battery_base(
        "batt_009",
        brand="Deye",
        model="RW-F10.2 LiFePO4",
        usable_kwh=9.2,
        capacity_kwh=10.24,
        sku="RW-F10.2",
        distributor="Deye PH distributors",
        price_min=165000,
        price_max=195000,
        charge_kw=5.0,
        discharge_kw=5.0,
        recommended_brands=["Deye"],
        website="https://www.deyeinverter.com",
    ),
    _battery_base(
        "batt_010",
        brand="Growatt",
        model="ARK 2.5 LiFePO4",
        usable_kwh=2.3,
        capacity_kwh=2.56,
        sku="ARK-2.5",
        distributor="Growatt PH authorized distributors",
        price_min=52000,
        price_max=65000,
        charge_kw=1.28,
        discharge_kw=1.28,
        recommended_brands=["Growatt"],
        website="https://www.growatt.com",
    ),
    _battery_base(
        "batt_011",
        brand="Felicity Solar",
        model="48V 100Ah LiFePO4",
        usable_kwh=4.8,
        capacity_kwh=5.12,
        sku="FLA48200",
        distributor="Online PH solar retailers, budget hybrid kits",
        price_min=68000,
        price_max=82000,
        charge_kw=4.8,
        discharge_kw=4.8,
        recommended_brands=["Deye", "Growatt", "Sunsynk"],
        website="https://www.felicitysolar.com",
    ),
    _battery_base(
        "batt_012",
        brand="LuxPower",
        model="LP16-48100",
        usable_kwh=4.8,
        capacity_kwh=5.12,
        sku="LP16-48100",
        distributor="LuxPower PH distributors, hybrid kit resellers",
        price_min=72000,
        price_max=88000,
        charge_kw=5.0,
        discharge_kw=5.0,
        recommended_brands=["Deye", "Growatt", "LuxPower"],
        website="https://www.luxpower.com",
    ),
    _battery_base(
        "batt_013",
        brand="Huawei",
        model="LUNA2000-10-S0",
        usable_kwh=9.0,
        capacity_kwh=10.0,
        sku="LUNA2000-10-S0",
        distributor="Huawei FusionSolar partners",
        price_min=195000,
        price_max=235000,
        charge_kw=5.0,
        discharge_kw=5.0,
        recommended_brands=["Huawei"],
        website="https://solar.huawei.com",
    ),
    _battery_base(
        "batt_014",
        brand="Alpha ESS",
        model="SMILE-BAT-5.1",
        usable_kwh=4.6,
        capacity_kwh=5.12,
        sku="SMILE-BAT-5.1",
        distributor="Alpha ESS PH partners",
        price_min=98000,
        price_max=118000,
        charge_kw=2.5,
        discharge_kw=2.5,
        recommended_brands=["Alpha ESS", "Solis"],
        website="https://www.alpha-ess.com",
    ),
    _battery_base(
        "batt_015",
        brand="Victron Energy",
        model="Lithium Battery Smart 48V 200Ah",
        usable_kwh=9.6,
        capacity_kwh=10.24,
        sku="BAT548200050",
        distributor="Victron authorized PH dealers",
        price_min=210000,
        price_max=255000,
        charge_kw=5.0,
        discharge_kw=5.0,
        recommended_brands=["Victron"],
        website="https://www.victronenergy.com",
    ),
    _battery_base(
        "batt_016",
        brand="Dyness",
        model="Tower T10",
        usable_kwh=9.2,
        capacity_kwh=10.24,
        sku="Tower-T10",
        distributor="Dyness PH distributors",
        price_min=155000,
        price_max=185000,
        charge_kw=5.0,
        discharge_kw=5.0,
        recommended_brands=["Deye", "Growatt", "Solis"],
        website="https://www.dyness.com",
    ),
]

NEW_PACKAGES: dict[str, list[dict[str, Any]]] = {
    "protections": [
        {
            "id": "prot_003",
            "brand": "Schneider Electric",
            "model": "Acti9 DC Surge Protection Kit",
            "category": "protection",
            "description": "Type 2 DC surge protection for residential string inverters",
            "price_php": _price(6500, 9500),
            "warranty": {"years": 5},
            "unit": "lot",
        },
        {
            "id": "prot_004",
            "brand": "Generic",
            "model": "Three-Phase C&I Protection Kit",
            "category": "protection",
            "description": "Protection and isolation for small commercial three-phase tie-in",
            "price_php": _price(18000, 28000),
            "warranty": {"years": 5},
            "unit": "lot",
        },
    ],
    "mounting_kits": [
        {
            "id": "mount_003",
            "brand": "Generic",
            "model": "Flat Concrete Roof Ballasted Kit (per kWp)",
            "category": "mounting",
            "description": "Ballasted mounting for flat rooftop installs common in Metro Manila condos",
            "price_php_per_kwp": _price(9000, 14000),
            "warranty": {"years": 10},
            "unit": "kWp",
        },
        {
            "id": "mount_004",
            "brand": "K2 Systems",
            "model": "CrossRail Tile Roof Kit (per kWp)",
            "category": "mounting",
            "description": "Premium aluminum rail system for typhoon-exposed coastal installs",
            "price_php_per_kwp": _price(11000, 16000),
            "warranty": {"years": 12},
            "unit": "kWp",
        },
    ],
    "cabling": [
        {
            "id": "cable_002",
            "brand": "Generic",
            "model": "Premium UV-Rated DC Cable Package",
            "category": "cabling",
            "description": "Double-insulated PV wire rated for tropical UV exposure",
            "price_php_per_kwp": _price(6500, 9500),
            "warranty": {"years": 5},
            "unit": "kWp",
        }
    ],
    "misc_bom_items": [
        {
            "id": "misc_003",
            "brand": "Generic",
            "model": "Meralco Net Metering Application Support",
            "category": "installation",
            "description": "Document preparation and liaison for utility net metering application",
            "price_php": _price(8000, 18000),
            "warranty": {"years": 0},
            "unit": "lot",
        },
        {
            "id": "misc_004",
            "brand": "Generic",
            "model": "Structural Assessment (Basic)",
            "category": "installation",
            "description": "Basic roof load review by partner engineer for residential installs",
            "price_php": _price(3500, 8000),
            "warranty": {"years": 0},
            "unit": "lot",
        },
    ],
}


def _panel_supports_micro(panel: dict[str, Any], inverter: dict[str, Any]) -> bool:
    """True when per-panel DC:AC would fall inside the solver window (1.05–1.30)."""
    ratio = panel["wattage_w"] / inverter["rated_ac_output_w"]
    return 1.05 <= ratio <= 1.30


def _micro_inverter_ids(inverters: list[dict[str, Any]]) -> set[str]:
    return {
        inv["id"]
        for inv in inverters
        if inv.get("type") == "microinverter" or inv["rated_ac_output_w"] <= 1000
    }


def _string_inverter_ids(inverters: list[dict[str, Any]]) -> set[str]:
    return {
        inv["id"]
        for inv in inverters
        if inv["id"] not in _micro_inverter_ids(inverters)
    }


def _wire_compat(catalog: dict[str, Any]) -> None:
    inverters = catalog["inverters"]
    micro_ids = sorted(_micro_inverter_ids(inverters))
    string_ids = sorted(_string_inverter_ids(inverters))

    budget_grid = {
        inv["id"]
        for inv in inverters
        if inv.get("type") == "grid_tie"
        and not inv.get("battery_compatible")
        and inv["rated_ac_output_w"] <= 5000
        and inv["price_php"]["min"] <= 36000
    }
    premium_grid = {
        inv["id"]
        for inv in inverters
        if inv.get("type") == "grid_tie"
        and inv["id"] not in budget_grid
        and inv["id"] not in micro_ids
    }
    hybrid_ids = {
        inv["id"] for inv in inverters if inv.get("battery_compatible") and inv["id"] not in micro_ids
    }

    for panel in catalog["panels"]:
        pid = panel["id"]
        wattage = panel["wattage_w"]
        existing = set(panel.get("certified_compatible_inverters", []))

        micro_for_panel = {
            inv_id
            for inv_id in micro_ids
            if _panel_supports_micro(panel, inverters_by_id(inverters, inv_id))
        }

        if pid == "panel_008":
            panel["certified_compatible_inverters"] = sorted(existing | micro_for_panel)
            continue

        if wattage >= 550:
            allowed = existing | budget_grid | premium_grid | hybrid_ids | micro_for_panel
        elif wattage <= 420:
            allowed = (
                existing
                | {
                    i
                    for i in string_ids
                    if inverters_by_id(inverters, i)["rated_ac_output_w"] <= 5000
                }
                | micro_for_panel
            )
        else:
            allowed = existing | set(string_ids) | micro_for_panel

        panel["certified_compatible_inverters"] = sorted(allowed)

    for inv in inverters:
        if not inv.get("battery_compatible"):
            continue
        brand = inv["brand"]
        certs = set(inv.get("certified_batteries", []))
        for batt in catalog["batteries"]:
            if brand in batt.get("recommended_inverter_brands", []) or brand == batt["brand"]:
                certs.add(batt["id"])
        inv["certified_batteries"] = sorted(certs)


def inverters_by_id(inverters: list[dict[str, Any]], inv_id: str) -> dict[str, Any]:
    for inv in inverters:
        if inv["id"] == inv_id:
            return inv
    raise KeyError(inv_id)


def _merge_unique(existing: list[dict[str, Any]], new_items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen = {item["id"] for item in existing}
    merged = list(existing)
    for item in new_items:
        if item["id"] in seen:
            continue
        merged.append(item)
        seen.add(item["id"])
    return merged


def expand_catalog(raw: dict[str, Any]) -> dict[str, Any]:
    catalog = copy.deepcopy(raw)

    catalog["panels"] = _merge_unique(catalog["panels"], NEW_PANELS)
    catalog["inverters"] = _merge_unique(catalog["inverters"], NEW_INVERTERS)
    catalog["batteries"] = _merge_unique(catalog["batteries"], NEW_BATTERIES)

    for key, items in NEW_PACKAGES.items():
        catalog[key] = _merge_unique(catalog.get(key, []), items)

    _wire_compat(catalog)

    catalog["catalog_metadata"] = {
        **catalog.get("catalog_metadata", {}),
        "last_catalog_update": AS_OF,
        "panel_count": len(catalog["panels"]),
        "inverter_count": len(catalog["inverters"]),
        "battery_count": len(catalog["batteries"]),
        "notes": (
            "Expanded PH-market reference catalog for development and testing. "
            "Prices and availability are illustrative."
        ),
    }

    catalog["compatibility_notes"] = catalog.get("compatibility_notes", []) + [
        {
            "component_a": "panel_004",
            "component_b": "inv_011",
            "status": "compatible",
            "note": "3 kW Growatt pairs cleanly with 8×450W (~3.6 kWp) — common townhouse sizing in PH.",
        },
        {
            "component_a": "panel_001",
            "component_b": "inv_019",
            "status": "compatible",
            "note": "Deye 3 kW hybrid supports brownout backup on typical Luzon residential loads.",
        },
        {
            "component_a": "inv_019",
            "component_b": "batt_012",
            "status": "compatible",
            "note": "LuxPower battery commonly bundled with Deye hybrid kits sold online in PH.",
        },
        {
            "component_a": "panel_018",
            "component_b": "inv_013",
            "status": "compatible",
            "note": "Compact 400W panels suit limited Metro Manila roof planes with 3 kW GoodWe inverter.",
        },
        {
            "component_a": "panel_002",
            "component_b": "inv_025",
            "status": "compatible_with_warning",
            "note": "8 kW Huawei suits high-consumption homes; verify Imp vs MPPT current at noon cell temps.",
        },
    ]

    return catalog


def main() -> None:
    raw = json.loads(CATALOG_PATH.read_text())
    expanded = expand_catalog(raw)
    CATALOG_PATH.write_text(json.dumps(expanded, indent=2) + "\n")
    print(
        f"Expanded catalog: {len(expanded['panels'])} panels, "
        f"{len(expanded['inverters'])} inverters, "
        f"{len(expanded['batteries'])} batteries"
    )


if __name__ == "__main__":
    main()
