# Kahayag Energy Calculation Methodology v1.1

## 1. Purpose and Scope

Defines the MVP formulas for preliminary residential rooftop-solar sizing, cost, savings, and payback estimates in the Philippines. Outputs are planning estimates, not engineering designs or installer quotations.

## 2. Inputs

### 2.1 User Inputs

| Input                      | Required    | Unit / Type              | Default and Fallback                                                                                                                      |
| -------------------------- | ----------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `roofAreaM2`               | Yes         | m²                       | Must be greater than 0. Represents the user-confirmed candidate roof area, not the whole property footprint.                              |
| `usableRoofAreaM2`         | Yes         | m²                       | Candidate roof area remaining after the tracing UI accounts for edges, access, spacing, ridges, and visible obstructions. Must be greater than 0 and no greater than `roofAreaM2`. |
| `monthlyConsumptionKwh`    | Conditional | kWh/month                | Required when `monthlyBillPhp` is absent.                                                                                                 |
| `monthlyBillPhp`           | Conditional | ₱/month                  | Used only when `monthlyConsumptionKwh` is absent.                                                                                         |
| `electricityRatePhpPerKwh` | No          | ₱/kWh                    | Use the user or utility-specific rate when available. Otherwise use ₱12.00/kWh and label the result as using a national planning default. |
| `budgetPhp`                | No          | ₱                        | When missing, set the budget constraint to `Infinity`; budget must not reduce the recommendation.                                         |
| `panelCategoryId`          | No          | string                   | Default: `standard-450`.                                                                                                                  |
| `batteryOptionId`          | No          | string                   | Default: `none`.                                                                                                                          |
| `netMeteringStatus`        | No          | `yes`, `no`, or `unsure` | Default: `unsure`. Treat `unsure` as no export credit for conservative financial calculations.                                            |
| `exportCreditPhpPerKwh`    | Conditional | ₱/kWh                    | Required for a utility-specific net-metering estimate. If unavailable, use 0 and show a warning.                                          |

### 2.2 Bill-to-Consumption Conversion

When consumption is unavailable:

```text
monthlyConsumptionKwh =
monthlyBillPhp / electricityRatePhpPerKwh
```

Rules:

1. Prefer a rate taken from the user's bill or current distribution-utility schedule.
2. If no rate is supplied, use ₱12.00/kWh.
3. Mark the output `usesDefaultTariff = true`.
4. State that fixed charges and tiered bill components make the converted consumption approximate.

The ₱12.00/kWh fallback is a configurable nationwide planning value, not a claim about a specific utility. Philippine retail tariffs vary by distribution utility, customer class, billing month, and pass-through charges. The Department of Energy advises using the customer's current electricity purchase price and checking applicable values with the installer and distribution utility ([DOE, “How to buy a solar rooftop from your installer,” retrieved 2026-07-25](https://legacy.doe.gov.ph/4-how-buy-solar-roof-top-your-installer)).

---

## 3. Configuration

All values below must be stored as configuration rather than embedded across calculation functions.

### 3.1 Panel Categories

| ID                | Category    | Wattage |    Dimensions |      Area | Rationale and Source                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------- | ----------- | ------: | ------------: | --------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `standard-450`    | Standard    |   450 W | 1.13 × 1.76 m | 1.9888 m² | Representative modern residential module used as the default planning record. Final implementation should replace or extend this record with actual manufacturer datasheets. The DOE recommends verifying module type, rated capacity, certifications, and manufacturer information in installer offers ([DOE consumer guide, retrieved 2026-07-25](https://legacy.doe.gov.ph/4-how-buy-solar-roof-top-your-installer)). |
| `high-output-550` | High-output |   550 W | 1.13 × 1.76 m | 1.9888 m² | Models a higher-efficiency module using the same layout footprint so users can compare output without changing roof geometry. This is an MVP category assumption and must be labelled as such until tied to a specific datasheet.                                                                                                                                                                                        |

```text
panelAreaM2 = panelWidthM * panelLengthM
```

### 3.2 Physical and Energy Defaults

| Parameter                     |      Value | Rationale and Traceable Source                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------- | ---------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `peakSunHoursPerDay`          |  5.0 h/day | Nationwide fallback within the 4.5–5.5 kWh/m²/day range stated in the Kahayag technical profile. Use location-specific Global Solar Atlas or NASA POWER data when available. The fallback is intentionally central rather than optimistic.                                                                                                                                                                                                                                                                                                                                                                                |
| `performanceRatio`            |       0.80 | Conservative simplified factor for temperature, inverter, wiring, mismatch, availability, and soiling losses. NREL PVWatts uses explicit system-loss modelling and currently shows a 14% default system-loss input; a Philippine rooftop case reported a 77.10% performance ratio, supporting 0.80 as a practical pre-feasibility simplification ([NREL PVWatts V8, retrieved 2026-07-25](https://pvwatts.nrel.gov/version_8.php); [Taduran and Piao, 2025](https://arxiv.org/abs/2510.03487)).                                                                                                                           |
| `annualPanelDegradationRatio` | 0.005/year | Matches the 0.5% degradation assumption used in the DOE's Philippine rooftop ROI example ([DOE consumer guide, retrieved 2026-07-25](https://legacy.doe.gov.ph/4-how-buy-solar-roof-top-your-installer)).                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `analysisYears`               |   25 years | Planning horizon aligned with common PV performance-warranty periods. It is an MVP financial horizon, not a guarantee that every component lasts 25 years.                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `electricityEscalationRatio`  |  0.00/year | Keeps projections in today's pesos and prevents speculative tariff growth from inflating savings.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `maintenanceCostPhpPerYear`   |          0 | Excluded from the MVP calculation and disclosed as a limitation. The DOE example includes annual O&M, showing that zero is a simplification rather than a professional lifecycle estimate ([DOE consumer guide, retrieved 2026-07-25](https://legacy.doe.gov.ph/4-how-buy-solar-roof-top-your-installer)).                                                                                                                                                                                                                                                                                                                |

### 3.3 Solar Installed-Cost Scenarios

| Scenario          |        Cost | Rationale and Source                                                                                                                                                                                                                                                                                                                                  |
| ----------------- | ----------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Conservative low  | ₱50,000/kWp | Lower planning bound. Current Philippine market guides report approximately ₱45,000–₱60,000/kWp or ₱50,000–₱65,000/kWp for grid-tied systems ([GroundWork, retrieved 2026-07-25](https://groundwork.ph/guides/solar-cost-philippines); [Sunexus, updated 2026-07-12, retrieved 2026-07-25](https://sunexus.ph/guides/solar-system-cost-philippines)). |
| Base              | ₱60,000/kWp | Midpoint planning allowance within the cited contemporary ranges. Used for affordability sizing and the base payback result.                                                                                                                                                                                                                          |
| Conservative high | ₱70,000/kWp | Upper allowance for premium equipment, difficult roof access, regional logistics, and quotation-scope differences. A 2026 installer guide reports ₱55,000–₱75,000/kWp ([SolarInstallPH, updated 2026-04, retrieved 2026-07-25](https://solarinstallph.com/blog/residential-solar-cost/)).                                                             |

These are market-planning allowances, not regulated prices. Replace them with a dated set of comparable installer quotations when available.

### 3.4 Battery Options and Cost Scenarios

| ID         | Nominal Capacity | Self-Consumption Ratio | Low Cost | Base Cost | High Cost |
| ---------- | ---------------: | ---------------------: | -------: | --------: | --------: |
| `none`     |            0 kWh |                   0.40 |       ₱0 |        ₱0 |        ₱0 |
| `small-5`  |            5 kWh |                   0.65 |  ₱75,000 |   ₱90,000 |  ₱125,000 |
| `large-10` |           10 kWh |                   0.80 | ₱150,000 |  ₱180,000 |  ₱250,000 |

Equivalent configurable battery allowances:

```text
batteryCostLowPhpPerKwh  = 15000
batteryCostBasePhpPerKwh = 18000
batteryCostHighPhpPerKwh = 25000
```

The self-consumption ratios are simplified MVP heuristics, not outputs of hourly load and battery-dispatch simulation. They already represent the assumed net effect of storage; do not multiply them by battery efficiency again. Battery degradation, usable depth of discharge, power limits, backup reserve, and replacement are excluded.

The cost values must be validated against dated supplier or installer quotations before production use. Their wide range is deliberate because battery-only, hybrid-inverter, installation, warranty, and brand scopes differ materially.

### 3.5 Net-Metering Configuration

Philippine net-metering credits must not be modelled as a fixed percentage of the retail tariff. ERC rules compensate exported energy using the applicable distribution-utility methodology, historically linked to blended generation cost rather than full retail rate ([ERC clarification, retrieved 2026-07-25](https://www.erc.gov.ph/Press-Singular/61902)). ERC Resolution No. 15, Series of 2025 amended the net-metering rules and permits credit banking and rollover ([ERC 2025 amendment, retrieved 2026-07-25](https://erc.gov.ph/Press-Singular/84441)).

Rules:

```text
if netMeteringStatus == "yes" and exportCreditPhpPerKwh is known:
    appliedExportCreditPhpPerKwh = exportCreditPhpPerKwh
else:
    appliedExportCreditPhpPerKwh = 0
```

When status is `unsure`, calculate no export revenue and display:

> Export credits excluded because net-metering eligibility and the applicable distribution-utility credit rate were not confirmed.

---

## 4. Calculation Pipeline

### Step 1: Resolve Monthly Consumption

```text
if monthlyConsumptionKwh is provided:
    resolvedMonthlyConsumptionKwh = monthlyConsumptionKwh
else:
    resolvedMonthlyConsumptionKwh =
        monthlyBillPhp / electricityRatePhpPerKwh

annualConsumptionKwh =
    resolvedMonthlyConsumptionKwh * 12
```

Reject values less than or equal to 0.

### Step 2: Confirm Usable Roof Area

```text
usableRoofAreaM2 = tracingUiConfirmedUsableRoofAreaM2
```

The tracing UI owns this filtering step because it has the user-confirmed
candidate polygon and obstruction context. The backend validates that
`usableRoofAreaM2` is positive and does not exceed `roofAreaM2`; it does not
apply an additional utilization ratio.

### Step 3: Calculate Roof-Limited Panel Count

```text
roofLimitedPanelCount =
    floor(usableRoofAreaM2 / selectedPanel.areaM2)
```

### Step 4: Calculate Roof-Limited System Size

```text
roofLimitedSystemSizeKwp =
    roofLimitedPanelCount * selectedPanel.wattageW / 1000
```

### Step 5: Calculate Consumption-Limited System Size

```text
annualYieldPerKwpKwh =
    peakSunHoursPerDay * 365 * performanceRatio

consumptionLimitedSystemSizeKwp =
    annualConsumptionKwh / annualYieldPerKwpKwh
```

This prevents recommending annual generation above annual consumption before export economics are confirmed.

### Step 6: Resolve Battery Cost

```text
batteryCostLowPhp =
    selectedBattery.nominalCapacityKwh * batteryCostLowPhpPerKwh

batteryCostBasePhp =
    selectedBattery.nominalCapacityKwh * batteryCostBasePhpPerKwh

batteryCostHighPhp =
    selectedBattery.nominalCapacityKwh * batteryCostHighPhpPerKwh
```

### Step 7: Calculate Budget-Limited System Size

Use the base cost for affordability sizing.

```text
if budgetPhp is missing:
    budgetLimitedSystemSizeKwp = Infinity
else:
    availableSolarBudgetPhp =
        max(0, budgetPhp - batteryCostBasePhp)

    budgetLimitedSystemSizeKwp =
        availableSolarBudgetPhp / solarCostBasePhpPerKwp
```

A battery option is unaffordable when:

```text
budgetPhp is provided
and budgetPhp < batteryCostBasePhp
```

In that case, return a validation error or recommend `none`; do not produce a negative solar size.

### Step 8: Determine Preliminary System Size

```text
preliminarySystemSizeKwp =
    min(
        roofLimitedSystemSizeKwp,
        consumptionLimitedSystemSizeKwp,
        budgetLimitedSystemSizeKwp
    )
```

### Step 9: Convert to an Installable Panel Count

```text
recommendedPanelCount =
    floor(
        preliminarySystemSizeKwp * 1000
        / selectedPanel.wattageW
    )

recommendedSystemSizeKwp =
    recommendedPanelCount * selectedPanel.wattageW / 1000
```

All downstream calculations must use `recommendedSystemSizeKwp`, not the unrounded preliminary value.

If `recommendedPanelCount < 1`, return `NO_FEASIBLE_SYSTEM`.

### Step 10: Calculate Year-1 Generation

```text
year1GenerationKwh =
    recommendedSystemSizeKwp
    * peakSunHoursPerDay
    * 365
    * performanceRatio
```

Use the name `year1GenerationKwh` consistently in all later steps.

### Step 11: Calculate Self-Consumed and Exported Energy

```text
selfConsumptionRatio =
    selectedBattery.selfConsumptionRatio

selfConsumedEnergyKwh =
    min(
        year1GenerationKwh * selfConsumptionRatio,
        annualConsumptionKwh
    )

exportedEnergyKwh =
    max(0, year1GenerationKwh - selfConsumedEnergyKwh)
```

The ratio is a simplified annual heuristic. `batteryCapacityKwh × efficiency` must not be added directly to annual energy because battery capacity is an instantaneous storage quantity, not yearly delivered energy.

### Step 12: Calculate Year-1 Savings

```text
avoidedPurchaseValuePhp =
    selfConsumedEnergyKwh
    * electricityRatePhpPerKwh

exportCreditValuePhp =
    exportedEnergyKwh
    * appliedExportCreditPhpPerKwh

year1SavingsPhp =
    avoidedPurchaseValuePhp
    + exportCreditValuePhp
```

When net metering is `no` or `unsure`, `exportCreditValuePhp = 0`.

### Step 13: Calculate Installed-Cost Range

```text
solarCostLowPhp =
    recommendedSystemSizeKwp * solarCostLowPhpPerKwp

solarCostBasePhp =
    recommendedSystemSizeKwp * solarCostBasePhpPerKwp

solarCostHighPhp =
    recommendedSystemSizeKwp * solarCostHighPhpPerKwp

totalCostLowPhp =
    solarCostLowPhp + batteryCostLowPhp

totalCostBasePhp =
    solarCostBasePhp + batteryCostBasePhp

totalCostHighPhp =
    solarCostHighPhp + batteryCostHighPhp
```

Required outputs:

```text
estimatedCostRangePhp = [
    totalCostLowPhp,
    totalCostHighPhp
]

estimatedBaseCostPhp =
    totalCostBasePhp
```

### Step 14: Calculate Simple Payback Range

```text
if year1SavingsPhp <= 0:
    paybackLowYears = null
    paybackBaseYears = null
    paybackHighYears = null
else:
    paybackLowYears =
        totalCostLowPhp / year1SavingsPhp

    paybackBaseYears =
        totalCostBasePhp / year1SavingsPhp

    paybackHighYears =
        totalCostHighPhp / year1SavingsPhp
```

This is simple payback only. It excludes financing, maintenance, component replacement, taxes, and discounting.

### Step 15: Calculate 25-Year Projection

For year `n`, where `1 <= n <= analysisYears`:

```text
yearNGenerationKwh =
    year1GenerationKwh
    * (1 - annualPanelDegradationRatio)^(n - 1)

yearNSelfConsumedEnergyKwh =
    min(
        yearNGenerationKwh * selfConsumptionRatio,
        annualConsumptionKwh
    )

yearNExportedEnergyKwh =
    max(
        0,
        yearNGenerationKwh - yearNSelfConsumedEnergyKwh
    )

yearNSavingsPhp =
    yearNSelfConsumedEnergyKwh
        * electricityRatePhpPerKwh
    + yearNExportedEnergyKwh
        * appliedExportCreditPhpPerKwh
```

```text
lifetimeGenerationKwh =
    sum(yearNGenerationKwh for years 1..25)

lifetimeSavingsPhp =
    sum(yearNSavingsPhp for years 1..25)
```

Electricity rates and export credits remain constant in today's pesos.

---

## 5. Required Outputs

| Output                         | Unit / Type             |
| ------------------------------ | ----------------------- |
| `estimatedMonthlyConsumptionKwh` | kWh/month             |
| `annualConsumptionKwh`         | kWh/year                |
| `consumptionLimitedSystemSizeKwp` | kWp                  |
| `consumptionSource`            | `direct` or `bill`      |
| `recommendedPanelCount`        | integer                 |
| `recommendedSystemSizeKwp`     | kWp                     |
| `selectedPanelCategory`        | object                  |
| `selectedBatteryOption`        | object                  |
| `year1GenerationKwh`           | kWh/year                |
| `selfConsumedEnergyKwh`        | kWh/year                |
| `exportedEnergyKwh`            | kWh/year                |
| `annualConsumptionOffsetRatio` | decimal                 |
| `estimatedCostRangePhp`        | `[min, max]`            |
| `estimatedBaseCostPhp`         | ₱                       |
| `year1SavingsPhp`              | ₱/year                  |
| `paybackRangeYears`            | `[low, high]` or `null` |
| `paybackBaseYears`             | years or `null`         |
| `lifetimeGenerationKwh`        | kWh                     |
| `lifetimeSavingsPhp`           | ₱                       |
| `usesDefaultTariff`            | boolean                 |
| `exportCreditIncluded`         | boolean                 |
| `warnings`                     | string array            |

```text
annualConsumptionOffsetRatio =
    min(1, selfConsumedEnergyKwh / annualConsumptionKwh)
```

### CALC-04 Implemented API Subset

The current demo API implements the deterministic, battery-free financial
subset of Steps 12–14. It returns `annual_savings_php`,
`monthly_savings_php`, `estimated_cost_low_php`, `estimated_base_cost_php`,
`estimated_cost_high_php`, and the base-cost `payback_years`; it does not yet
return the full payback range defined in Step 14. `monthly_savings_php` is
`floor(annual_savings_php / 12)`, and `payback_years` is `null` when annual
savings are zero.

For an omitted budget, `budget_gap_php` is `null` and the budget does not
constrain sizing. For a supplied budget, it is
`max(0, estimated_cost_low_php - budget_php)`, and `budget_compatible` is true
exactly when that gap is zero. Affordability sizing still uses the base-cost
tier. If that tier cannot fund one panel, the API returns a one-panel minimum
estimate; its gap reports the shortfall against the low installed-cost tier.
CALC-04 excludes financing, batteries, loans, export credits, and net
metering.

---

## 6. Validation and Fallback Rules

| Condition                                       | Result                                                     |
| ----------------------------------------------- | ---------------------------------------------------------- |
| Missing both consumption and bill               | `MISSING_ENERGY_INPUT`                                     |
| Tariff missing while converting bill            | Use ₱12.00/kWh and add `DEFAULT_TARIFF_USED`               |
| Roof area <= 0                                  | `INVALID_ROOF_AREA`                                        |
| Consumption, bill, tariff, or budget <= 0       | `INVALID_NUMERIC_INPUT`                                    |
| Battery base cost exceeds supplied budget       | `BATTERY_EXCEEDS_BUDGET`                                   |
| Roof or demand constraint cannot fit one panel   | `NO_FEASIBLE_SYSTEM`                                       |
| Budget cannot fund one panel                     | Return a one-panel minimum estimate and its budget gap     |
| Net metering `unsure`                           | Export credit = 0; add `NET_METERING_UNCONFIRMED`          |
| Net metering `yes`, credit unknown              | Export credit = 0; add `EXPORT_RATE_UNAVAILABLE`           |
| Payback exceeds 25 years                        | Report the value and add `PAYBACK_EXCEEDS_ANALYSIS_PERIOD` |
| Cost source older than configured review period | Add `COST_DATA_REVIEW_REQUIRED`                            |

---

## 7. Professional-Assessment Boundary

Kahayag provides a preliminary desktop estimate. It does not include or replace:

- on-site structural inspection, load assessment, roof-condition assessment, waterproofing review, or confirmation that the roof can safely support the system;
- measured shading survey or professional analysis of roof azimuth, tilt, seasonal obstruction, nearby trees, or future construction;
- final panel layout, mounting design, wind-loading design, setbacks, fire access, or compliance with local building requirements;
- inverter selection, DC/AC sizing, string design, clipping analysis, cable sizing, protection-device design, grounding, surge protection, or single-line electrical diagrams;
- distribution-utility interconnection study, hosting-capacity confirmation, meter requirements, net-metering eligibility, approval, processing time, or final export-credit rate;
- permits, professional fees, taxes or VAT treatment, inspection fees, net-metering charges, insurance, and local-government requirements;
- service entrance, panelboard, transformer, wiring, grounding, or other electrical upgrades;
- scaffolding, difficult roof access, freight, island or remote-area logistics, crane use, roof repair, civil works, and contractor mobilization;
- final equipment brand, warranty, installer workmanship scope, after-sales service, monitoring, maintenance, spare parts, and quotation validity;
- financing interest, loan fees, down payment, lease terms, insurance, discount rate, inflation, and changes in household consumption;
- battery usable capacity, depth of discharge, power rating, backup reserve, operating strategy, cycle degradation, warranty conditions, or replacement;
- future retail-tariff changes, export-credit changes, outages, curtailment, policy amendments, or unusual weather and typhoon years.

Every report must state:

> This result is a preliminary pre-feasibility estimate based on simplified inputs and configurable planning assumptions. A licensed solar professional must verify the property, roof, electrical system, equipment design, permits, utility requirements, and final quotation before purchase or installation.

---

## 8. Implementation Decisions Summary

- Costs are returned as low, base, and high scenarios.
- The user-facing cost output includes a min–max range.
- Panel types are configurable records containing wattage, dimensions, and area.
- Missing budget means no budget constraint, represented internally as `Infinity`.
- A bill is converted to consumption using the supplied or default tariff.
- Default tariff use is always disclosed.
- A `consumptionSource` value of `bill` signals that consumption was estimated
  using a flat tariff and must be disclosed as approximate in user-facing
  reports.
- Unknown net-metering status receives zero export credit.
- Export credit is a utility-specific input, not a fixed percentage of retail price.
- Battery self-consumption is implemented as a ratio of annual generation.
- Battery capacity is never added directly to annual energy.
- All downstream calculations use the rounded, installable system size.
- Financial results remain preliminary and exclude professional quotation scope.
