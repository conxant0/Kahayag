// Defines a mock design session for UI-first development and Person 3 imports.
import type { DesignSession } from "../../../shared/api/types";

export const mockDesignSessionFull = {
  "property_ref": "demo-property-1",
  "assessment_fingerprint": "f5ec50c9b7f57bfe",
  "active_build_id": "6ef90fb7-4b35-4e31-9ed4-2d17056e4a69",
  "builds": [
    {
      "id": "6ef90fb7-4b35-4e31-9ed4-2d17056e4a69",
      "label": "AI suggested",
      "tags": [
        "BEST ALL-ROUND"
      ],
      "combo_id": "panel_004:inv_005:none:13",
      "solve_id": "c73a8353-6a24-458b-84ff-def5a9c0fcb5",
      "system_kwp": 5.85,
      "panel_count": 13,
      "inverter_kw": 5.0,
      "battery_kwh": null,
      "monthly_savings_php": 6000.0,
      "annual_savings_php": 72000.0,
      "payback_years": 6.1,
      "total_investment_php": 439782.0,
      "total_investment_low_php": 354928.0,
      "total_investment_high_php": 524636.0,
      "subtotal_php": 392662.5,
      "vat_php": 47119.5,
      "inverter_utilisation_pct": 78.0,
      "fit_score": 83.6,
      "co2_tonnes_avoided_yearly": 5.38,
      "insight": "5.85 kWp system with DC:AC 1.17 and 78.0% inverter utilisation. Estimated payback 6.1 years.",
      "components": [
        {
          "slot": "panel",
          "catalog_id": "panel_004",
          "brand": "Trina Solar",
          "model": "Vertex S TSM-450DE09.08",
          "summary": "450W Trina Solar panel",
          "qty": 13.0,
          "unit": "pcs",
          "unit_price_php": 6600.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 85800.0,
          "warranty_note": "15-year product warranty",
          "badges": [
            "AUTO-SUGGESTED"
          ],
          "specs": {
            "wattage_w": 450,
            "efficiency_pct": 22.5,
            "voc_v": 41.8,
            "vmp_v": 35.1
          }
        },
        {
          "slot": "inverter",
          "catalog_id": "inv_005",
          "brand": "Solis",
          "model": "S5-GR1P5K",
          "summary": "5.0 kW Solis inverter",
          "qty": 1.0,
          "unit": "pcs",
          "unit_price_php": 28000.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 28000.0,
          "warranty_note": "10-year warranty",
          "badges": [
            "AUTO-SUGGESTED"
          ],
          "specs": {
            "rated_ac_kw": 5.0,
            "mppt_count": 2,
            "battery_compatible": 0
          }
        },
        {
          "slot": "protection",
          "catalog_id": "prot_005",
          "brand": "Generic",
          "model": "DC Combiner Box / String Junction Box",
          "summary": "IP65-rated combiner box with fuse holders for 2\u20134 PV strings",
          "qty": 1.0,
          "unit": "lot",
          "unit_price_php": 6000.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 6000.0,
          "warranty_note": "5-year warranty",
          "badges": [
            "INCLUDED"
          ],
          "specs": {}
        },
        {
          "slot": "protection",
          "catalog_id": "prot_006",
          "brand": "Generic",
          "model": "DC Isolator Switch (600V)",
          "summary": "Lockable DC disconnect switch for string inverter input side",
          "qty": 1.0,
          "unit": "pcs",
          "unit_price_php": 3650.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 3650.0,
          "warranty_note": "5-year warranty",
          "badges": [
            "INCLUDED"
          ],
          "specs": {}
        },
        {
          "slot": "protection",
          "catalog_id": "prot_007",
          "brand": "Generic",
          "model": "DC String Fuse Holder & Fuses (15A)",
          "summary": "PV-rated fuse holders and gPV fuses per string for overcurrent protection",
          "qty": 1.0,
          "unit": "lot",
          "unit_price_php": 1700.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 1700.0,
          "warranty_note": "5-year warranty",
          "badges": [
            "INCLUDED"
          ],
          "specs": {}
        },
        {
          "slot": "protection",
          "catalog_id": "prot_008",
          "brand": "Generic",
          "model": "AC Manual Disconnect Switch (63A)",
          "summary": "Lockable AC disconnect switch at inverter output, utility-side",
          "qty": 1.0,
          "unit": "pcs",
          "unit_price_php": 4500.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 4500.0,
          "warranty_note": "5-year warranty",
          "badges": [
            "INCLUDED"
          ],
          "specs": {}
        },
        {
          "slot": "protection",
          "catalog_id": "prot_009",
          "brand": "Schneider Electric",
          "model": "Acti9 iC60N AC Main Breaker (63A)",
          "summary": "Main AC circuit breaker in consumer unit for solar tie-in",
          "qty": 1.0,
          "unit": "pcs",
          "unit_price_php": 3500.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 3500.0,
          "warranty_note": "5-year warranty",
          "badges": [
            "INCLUDED"
          ],
          "specs": {}
        },
        {
          "slot": "protection",
          "catalog_id": "prot_011",
          "brand": "Phoenix Contact",
          "model": "VAL-MS DC Surge Protector (Type 2)",
          "summary": "Type 2 DC-side surge protection device for PV strings up to 1000V",
          "qty": 1.0,
          "unit": "pcs",
          "unit_price_php": 5750.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 5750.0,
          "warranty_note": "5-year warranty",
          "badges": [
            "INCLUDED"
          ],
          "specs": {}
        },
        {
          "slot": "protection",
          "catalog_id": "prot_012",
          "brand": "Phoenix Contact",
          "model": "VAL-MS AC Surge Protector (Type 2)",
          "summary": "Type 2 AC-side surge protection device at inverter output",
          "qty": 1.0,
          "unit": "pcs",
          "unit_price_php": 4900.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 4900.0,
          "warranty_note": "5-year warranty",
          "badges": [
            "INCLUDED"
          ],
          "specs": {}
        },
        {
          "slot": "protection",
          "catalog_id": "misc_007",
          "brand": "Generic",
          "model": "Weatherproof DC/AC Enclosure Box",
          "summary": "IP65 wall-mount enclosure for DC disconnect, SPD, and combiner components",
          "qty": 1.0,
          "unit": "pcs",
          "unit_price_php": 4750.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 4750.0,
          "warranty_note": "5-year warranty",
          "badges": [
            "INCLUDED"
          ],
          "specs": {}
        },
        {
          "slot": "structure",
          "catalog_id": "mount_001",
          "brand": "Generic",
          "model": "Tiled Roof Mount Kit (per kWp)",
          "summary": "Rails, clamps, and roof hooks for tiled residential roofs",
          "qty": 5.85,
          "unit": "kWp",
          "unit_price_php": 10000.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 58500.0,
          "warranty_note": "10-year warranty",
          "badges": [
            "INCLUDED"
          ],
          "specs": {}
        },
        {
          "slot": "electrical",
          "catalog_id": "cable_003",
          "brand": "Generic",
          "model": "DC PV Wire & MC4 Connector Kit",
          "summary": "4mm\u00b2/6mm\u00b2 PV1-F DC cable with MC4 male/female connectors per string",
          "qty": 5.85,
          "unit": "kWp",
          "unit_price_php": 4500.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 26325.0,
          "warranty_note": "5-year warranty",
          "badges": [
            "INCLUDED"
          ],
          "specs": {}
        },
        {
          "slot": "electrical",
          "catalog_id": "cable_004",
          "brand": "Generic",
          "model": "AC Output Cable & Terminal Lugs",
          "summary": "THHN/THWN AC cable from inverter to consumer unit with crimp lugs",
          "qty": 1.0,
          "unit": "lot",
          "unit_price_php": 3500.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 3500.0,
          "warranty_note": "5-year warranty",
          "badges": [
            "INCLUDED"
          ],
          "specs": {}
        },
        {
          "slot": "electrical",
          "catalog_id": "cable_005",
          "brand": "Generic",
          "model": "Grounding Conductor & Bonding Kit",
          "summary": "6 AWG bare copper grounding wire, lugs, and panel/frame bonding hardware",
          "qty": 1.0,
          "unit": "lot",
          "unit_price_php": 2750.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 2750.0,
          "warranty_note": "5-year warranty",
          "badges": [
            "INCLUDED"
          ],
          "specs": {}
        },
        {
          "slot": "electrical",
          "catalog_id": "cable_006",
          "brand": "Generic",
          "model": "PVC Conduit & Trunking Package",
          "summary": "PVC conduit, fittings, and cable trunking for roof-to-inverter runs",
          "qty": 5.85,
          "unit": "kWp",
          "unit_price_php": 2250.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 13162.5,
          "warranty_note": "5-year warranty",
          "badges": [
            "INCLUDED"
          ],
          "specs": {}
        },
        {
          "slot": "electrical",
          "catalog_id": "cable_007",
          "brand": "Generic",
          "model": "MC4 Branch Connector & Y-Adaptor Kit",
          "summary": "MC4 Y-branch connectors and inline fuses for parallel string wiring",
          "qty": 1.0,
          "unit": "lot",
          "unit_price_php": 1150.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 1150.0,
          "warranty_note": "5-year warranty",
          "badges": [
            "INCLUDED"
          ],
          "specs": {}
        },
        {
          "slot": "electrical",
          "catalog_id": "misc_006",
          "brand": "Generic",
          "model": "Grounding Electrode & Bonding Kit",
          "summary": "Ground rod, clamp, exothermic weld, and bonding jumpers for system grounding",
          "qty": 1.0,
          "unit": "lot",
          "unit_price_php": 3500.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 3500.0,
          "warranty_note": "5-year warranty",
          "badges": [
            "INCLUDED"
          ],
          "specs": {}
        },
        {
          "slot": "installation",
          "catalog_id": "misc_001",
          "brand": "Generic",
          "model": "Standard Installation Labour",
          "summary": "Labour, commissioning, and basic electrical work",
          "qty": 5.85,
          "unit": "kWp",
          "unit_price_php": 18500.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 108225.0,
          "warranty_note": "1-year warranty",
          "badges": [
            "INCLUDED"
          ],
          "specs": {}
        },
        {
          "slot": "installation",
          "catalog_id": "misc_002",
          "brand": "Generic",
          "model": "Permits & Documentation",
          "summary": "Net metering paperwork and local permit assistance",
          "qty": 1.0,
          "unit": "lot",
          "unit_price_php": 10000.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 10000.0,
          "warranty_note": "As per installer terms",
          "badges": [
            "INCLUDED"
          ],
          "specs": {}
        },
        {
          "slot": "installation",
          "catalog_id": "misc_005",
          "brand": "Secure / Elster",
          "model": "Bi-directional Production/Net Meter",
          "summary": "Utility-approved bi-directional meter for Meralco net metering program",
          "qty": 1.0,
          "unit": "pcs",
          "unit_price_php": 17000.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 17000.0,
          "warranty_note": "5-year warranty",
          "badges": [
            "INCLUDED"
          ],
          "specs": {}
        }
      ],
      "source": "ai_suggested"
    },
    {
      "id": "5ee6ce26-7737-4828-ad7e-5ac24fc4941e",
      "label": "Custom build A",
      "tags": [
        "ALTERNATE"
      ],
      "combo_id": "panel_004:inv_004:none:13",
      "solve_id": "c73a8353-6a24-458b-84ff-def5a9c0fcb5",
      "system_kwp": 5.85,
      "panel_count": 13,
      "inverter_kw": 5.0,
      "battery_kwh": null,
      "monthly_savings_php": 6000.0,
      "annual_savings_php": 72000.0,
      "payback_years": 6.1,
      "total_investment_php": 440902.0,
      "total_investment_low_php": 356048.0,
      "total_investment_high_php": 525756.0,
      "subtotal_php": 393662.5,
      "vat_php": 47239.5,
      "inverter_utilisation_pct": 78.0,
      "fit_score": 83.6,
      "co2_tonnes_avoided_yearly": 5.38,
      "insight": "5.85 kWp system with DC:AC 1.17 and 78.0% inverter utilisation. Estimated payback 6.1 years.",
      "components": [
        {
          "slot": "panel",
          "catalog_id": "panel_004",
          "brand": "Trina Solar",
          "model": "Vertex S TSM-450DE09.08",
          "summary": "450W Trina Solar panel",
          "qty": 13.0,
          "unit": "pcs",
          "unit_price_php": 6600.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 85800.0,
          "warranty_note": "15-year product warranty",
          "badges": [],
          "specs": {
            "wattage_w": 450,
            "efficiency_pct": 22.5,
            "voc_v": 41.8,
            "vmp_v": 35.1
          }
        },
        {
          "slot": "inverter",
          "catalog_id": "inv_004",
          "brand": "GoodWe",
          "model": "GW5000-DNS-30",
          "summary": "5.0 kW GoodWe inverter",
          "qty": 1.0,
          "unit": "pcs",
          "unit_price_php": 29000.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 29000.0,
          "warranty_note": "10-year warranty",
          "badges": [],
          "specs": {
            "rated_ac_kw": 5.0,
            "mppt_count": 2,
            "battery_compatible": 0
          }
        },
        {
          "slot": "protection",
          "catalog_id": "prot_005",
          "brand": "Generic",
          "model": "DC Combiner Box / String Junction Box",
          "summary": "IP65-rated combiner box with fuse holders for 2\u20134 PV strings",
          "qty": 1.0,
          "unit": "lot",
          "unit_price_php": 6000.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 6000.0,
          "warranty_note": "5-year warranty",
          "badges": [
            "INCLUDED"
          ],
          "specs": {}
        },
        {
          "slot": "protection",
          "catalog_id": "prot_006",
          "brand": "Generic",
          "model": "DC Isolator Switch (600V)",
          "summary": "Lockable DC disconnect switch for string inverter input side",
          "qty": 1.0,
          "unit": "pcs",
          "unit_price_php": 3650.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 3650.0,
          "warranty_note": "5-year warranty",
          "badges": [
            "INCLUDED"
          ],
          "specs": {}
        },
        {
          "slot": "protection",
          "catalog_id": "prot_007",
          "brand": "Generic",
          "model": "DC String Fuse Holder & Fuses (15A)",
          "summary": "PV-rated fuse holders and gPV fuses per string for overcurrent protection",
          "qty": 1.0,
          "unit": "lot",
          "unit_price_php": 1700.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 1700.0,
          "warranty_note": "5-year warranty",
          "badges": [
            "INCLUDED"
          ],
          "specs": {}
        },
        {
          "slot": "protection",
          "catalog_id": "prot_008",
          "brand": "Generic",
          "model": "AC Manual Disconnect Switch (63A)",
          "summary": "Lockable AC disconnect switch at inverter output, utility-side",
          "qty": 1.0,
          "unit": "pcs",
          "unit_price_php": 4500.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 4500.0,
          "warranty_note": "5-year warranty",
          "badges": [
            "INCLUDED"
          ],
          "specs": {}
        },
        {
          "slot": "protection",
          "catalog_id": "prot_009",
          "brand": "Schneider Electric",
          "model": "Acti9 iC60N AC Main Breaker (63A)",
          "summary": "Main AC circuit breaker in consumer unit for solar tie-in",
          "qty": 1.0,
          "unit": "pcs",
          "unit_price_php": 3500.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 3500.0,
          "warranty_note": "5-year warranty",
          "badges": [
            "INCLUDED"
          ],
          "specs": {}
        },
        {
          "slot": "protection",
          "catalog_id": "prot_011",
          "brand": "Phoenix Contact",
          "model": "VAL-MS DC Surge Protector (Type 2)",
          "summary": "Type 2 DC-side surge protection device for PV strings up to 1000V",
          "qty": 1.0,
          "unit": "pcs",
          "unit_price_php": 5750.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 5750.0,
          "warranty_note": "5-year warranty",
          "badges": [
            "INCLUDED"
          ],
          "specs": {}
        },
        {
          "slot": "protection",
          "catalog_id": "prot_012",
          "brand": "Phoenix Contact",
          "model": "VAL-MS AC Surge Protector (Type 2)",
          "summary": "Type 2 AC-side surge protection device at inverter output",
          "qty": 1.0,
          "unit": "pcs",
          "unit_price_php": 4900.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 4900.0,
          "warranty_note": "5-year warranty",
          "badges": [
            "INCLUDED"
          ],
          "specs": {}
        },
        {
          "slot": "protection",
          "catalog_id": "misc_007",
          "brand": "Generic",
          "model": "Weatherproof DC/AC Enclosure Box",
          "summary": "IP65 wall-mount enclosure for DC disconnect, SPD, and combiner components",
          "qty": 1.0,
          "unit": "pcs",
          "unit_price_php": 4750.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 4750.0,
          "warranty_note": "5-year warranty",
          "badges": [
            "INCLUDED"
          ],
          "specs": {}
        },
        {
          "slot": "structure",
          "catalog_id": "mount_001",
          "brand": "Generic",
          "model": "Tiled Roof Mount Kit (per kWp)",
          "summary": "Rails, clamps, and roof hooks for tiled residential roofs",
          "qty": 5.85,
          "unit": "kWp",
          "unit_price_php": 10000.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 58500.0,
          "warranty_note": "10-year warranty",
          "badges": [
            "INCLUDED"
          ],
          "specs": {}
        },
        {
          "slot": "electrical",
          "catalog_id": "cable_003",
          "brand": "Generic",
          "model": "DC PV Wire & MC4 Connector Kit",
          "summary": "4mm\u00b2/6mm\u00b2 PV1-F DC cable with MC4 male/female connectors per string",
          "qty": 5.85,
          "unit": "kWp",
          "unit_price_php": 4500.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 26325.0,
          "warranty_note": "5-year warranty",
          "badges": [
            "INCLUDED"
          ],
          "specs": {}
        },
        {
          "slot": "electrical",
          "catalog_id": "cable_004",
          "brand": "Generic",
          "model": "AC Output Cable & Terminal Lugs",
          "summary": "THHN/THWN AC cable from inverter to consumer unit with crimp lugs",
          "qty": 1.0,
          "unit": "lot",
          "unit_price_php": 3500.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 3500.0,
          "warranty_note": "5-year warranty",
          "badges": [
            "INCLUDED"
          ],
          "specs": {}
        },
        {
          "slot": "electrical",
          "catalog_id": "cable_005",
          "brand": "Generic",
          "model": "Grounding Conductor & Bonding Kit",
          "summary": "6 AWG bare copper grounding wire, lugs, and panel/frame bonding hardware",
          "qty": 1.0,
          "unit": "lot",
          "unit_price_php": 2750.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 2750.0,
          "warranty_note": "5-year warranty",
          "badges": [
            "INCLUDED"
          ],
          "specs": {}
        },
        {
          "slot": "electrical",
          "catalog_id": "cable_006",
          "brand": "Generic",
          "model": "PVC Conduit & Trunking Package",
          "summary": "PVC conduit, fittings, and cable trunking for roof-to-inverter runs",
          "qty": 5.85,
          "unit": "kWp",
          "unit_price_php": 2250.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 13162.5,
          "warranty_note": "5-year warranty",
          "badges": [
            "INCLUDED"
          ],
          "specs": {}
        },
        {
          "slot": "electrical",
          "catalog_id": "cable_007",
          "brand": "Generic",
          "model": "MC4 Branch Connector & Y-Adaptor Kit",
          "summary": "MC4 Y-branch connectors and inline fuses for parallel string wiring",
          "qty": 1.0,
          "unit": "lot",
          "unit_price_php": 1150.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 1150.0,
          "warranty_note": "5-year warranty",
          "badges": [
            "INCLUDED"
          ],
          "specs": {}
        },
        {
          "slot": "electrical",
          "catalog_id": "misc_006",
          "brand": "Generic",
          "model": "Grounding Electrode & Bonding Kit",
          "summary": "Ground rod, clamp, exothermic weld, and bonding jumpers for system grounding",
          "qty": 1.0,
          "unit": "lot",
          "unit_price_php": 3500.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 3500.0,
          "warranty_note": "5-year warranty",
          "badges": [
            "INCLUDED"
          ],
          "specs": {}
        },
        {
          "slot": "installation",
          "catalog_id": "misc_001",
          "brand": "Generic",
          "model": "Standard Installation Labour",
          "summary": "Labour, commissioning, and basic electrical work",
          "qty": 5.85,
          "unit": "kWp",
          "unit_price_php": 18500.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 108225.0,
          "warranty_note": "1-year warranty",
          "badges": [
            "INCLUDED"
          ],
          "specs": {}
        },
        {
          "slot": "installation",
          "catalog_id": "misc_002",
          "brand": "Generic",
          "model": "Permits & Documentation",
          "summary": "Net metering paperwork and local permit assistance",
          "qty": 1.0,
          "unit": "lot",
          "unit_price_php": 10000.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 10000.0,
          "warranty_note": "As per installer terms",
          "badges": [
            "INCLUDED"
          ],
          "specs": {}
        },
        {
          "slot": "installation",
          "catalog_id": "misc_005",
          "brand": "Secure / Elster",
          "model": "Bi-directional Production/Net Meter",
          "summary": "Utility-approved bi-directional meter for Meralco net metering program",
          "qty": 1.0,
          "unit": "pcs",
          "unit_price_php": 17000.0,
          "price_as_of": "2026-07-01",
          "line_total_php": 17000.0,
          "warranty_note": "5-year warranty",
          "badges": [
            "INCLUDED"
          ],
          "specs": {}
        }
      ],
      "source": "custom"
    }
  ],
  "last_solve": {
    "solve_id": "c73a8353-6a24-458b-84ff-def5a9c0fcb5",
    "constraints": {
      "target_kwp": 3.6,
      "max_panel_count": 14,
      "usable_roof_area_m2": 32.0,
      "budget_php": null,
      "require_battery": false,
      "min_battery_kwh": null,
      "goal": "auto"
    },
    "valid": [
      {
        "combo_id": "panel_004:inv_005:none:13",
        "panel_id": "panel_004",
        "inverter_id": "inv_005",
        "battery_id": null,
        "panel_count": 13,
        "system_kwp": 5.85,
        "dc_ac_ratio": 1.17,
        "inverter_utilisation_pct": 78.0,
        "fit_score": 83.6,
        "rejection_log_ref": "c73a8353-6a24-458b-84ff-def5a9c0fcb5",
        "estimated_cost_php": 392662.5
      },
      {
        "combo_id": "panel_004:inv_004:none:13",
        "panel_id": "panel_004",
        "inverter_id": "inv_004",
        "battery_id": null,
        "panel_count": 13,
        "system_kwp": 5.85,
        "dc_ac_ratio": 1.17,
        "inverter_utilisation_pct": 78.0,
        "fit_score": 83.6,
        "rejection_log_ref": "c73a8353-6a24-458b-84ff-def5a9c0fcb5",
        "estimated_cost_php": 393662.5
      },
      {
        "combo_id": "panel_002:inv_001:none:10",
        "panel_id": "panel_002",
        "inverter_id": "inv_001",
        "battery_id": null,
        "panel_count": 10,
        "system_kwp": 5.5,
        "dc_ac_ratio": 1.1,
        "inverter_utilisation_pct": 73.3,
        "fit_score": 72.16,
        "rejection_log_ref": "c73a8353-6a24-458b-84ff-def5a9c0fcb5",
        "estimated_cost_php": 321250.0
      },
      {
        "combo_id": "panel_002:inv_006:none:10",
        "panel_id": "panel_002",
        "inverter_id": "inv_006",
        "battery_id": null,
        "panel_count": 10,
        "system_kwp": 5.5,
        "dc_ac_ratio": 1.1,
        "inverter_utilisation_pct": 73.3,
        "fit_score": 72.16,
        "rejection_log_ref": "c73a8353-6a24-458b-84ff-def5a9c0fcb5",
        "estimated_cost_php": 323250.0
      }
    ],
    "rejections": [
      {
        "combo_key": "panel_001:inv_001:none:6",
        "code": "dc_ac_oversizing",
        "message": "DC:AC ratio 0.528 outside 1.1\u20131.3 window",
        "details": {
          "dc_ac_ratio": 0.528,
          "min_ratio": 1.1,
          "max_ratio": 1.3
        }
      }
    ]
  },
  "applied": false,
  "agent_audit": []
} as DesignSession;

export const mockCustomBuild = mockDesignSessionFull.builds[1]!;

export const mockDesignSession: DesignSession = {
  ...mockDesignSessionFull,
  builds: [mockDesignSessionFull.builds[0]!],
};

export const mockDesignSessionWithCustom: DesignSession = mockDesignSessionFull;
