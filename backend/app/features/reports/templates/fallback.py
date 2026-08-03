# Defines the deterministic fallback-report template boundary.

FALLBACK_SUMMARY = (
    "The assessment recommends {panel_count} panels for a "
    "{system_capacity_kwp} kWp system."
)
FALLBACK_REASON = (
    "The estimated system may generate {annual_generation_kwh} kWh per year "
    "under the listed planning assumptions."
)
FALLBACK_NEXT_STEPS = (
    "Ask a licensed solar professional to verify the roof and system design.",
    (
        "Request quotations and compare them with the estimated "
        "₱{estimated_cost_low_php}–₱{estimated_cost_high_php} range."
    ),
)
