# **Kahayag Energy MVP**

## **Product Requirements Document**

**Document status:** Revised Draft  
 **Product type:** Responsive web application  
 **Primary market:** Philippines  
 **Primary user:** Homeowners considering rooftop solar  
 **MVP objective:** Help a homeowner determine whether rooftop solar may be financially worthwhile and affordable for their property in under five minutes.

---

# **1\. Product Overview**

Kahayag Energy is a homeowner-facing solar pre-feasibility application.

The application enables a homeowner to:

1. Locate their property using a satellite map.  
2. Trace the usable area of their roof.  
3. Enter their average monthly electricity bill.  
4. Optionally enter an available upfront budget.  
5. Request an estimated budget when they do not know how much a suitable system may cost.  
6. Receive a recommended solar-panel category, panel count, and system size.  
7. View an automatically generated panel layout.  
8. Increase or decrease the panel count.  
9. Review estimated energy generation, installation-cost range, monthly savings, and payback period.  
10. Review a long-term investment projection for the recommended system.  
11. Understand how much confidence the estimate carries and which data it rests on.  
12. Generate and download an AI-written contractor-ready PDF report.

The recommendation is based on three primary constraints:

* Available roof space.  
* Estimated household electricity demand.  
* Available budget, when provided.

Where satellite solar data is available for the property, the generation estimate uses the measured sunlight reaching that specific roof rather than a nationwide average. Where it is not, the application falls back to a nationwide assumption and says so.

Kahayag Energy does not replace an on-site assessment by a licensed solar professional. Its output is a preliminary feasibility estimate intended to help homeowners make a more informed decision before approaching contractors.

Installation prices are shown as estimated ranges. Actual pricing may vary depending on the contractor, panel brand, inverter, roof design, regional availability, labor, permits, electrical work, and other site-specific factors.

---

# **2\. Problem Statement**

Many Filipino homeowners are interested in rooftop solar but lack a simple and trustworthy way to determine whether it is appropriate and affordable for their specific home.

Homeowners commonly face several problems:

* Generic calculators do not reflect their actual roof.  
* Contractor recommendations may vary significantly.  
* Users may not understand solar-system sizes or panel specifications.  
* Users may not know how many panels can fit on their roof.  
* Users may not know how much of their electricity bill solar can offset.  
* Users may not know how much a suitable system should cost.  
* Users may be uncertain whether they can afford the upfront investment.  
* Users may struggle to compare systems or contractor quotations.

This creates an information imbalance. Homeowners often contact contractors before they understand their own requirements, making it difficult to evaluate whether a recommendation is appropriate.

Existing tools frequently answer only one part of the decision:

* How much sunlight reaches an area.  
* How many panels might fit.  
* How much electricity a generic system might produce.  
* How much solar systems typically cost.

They often fail to connect the four questions that matter most to a homeowner:

1. **Will panels physically fit on my roof?**  
2. **How much electricity could they generate?**  
3. **What system can I afford?**  
4. **Would the investment be financially worthwhile?**

Affordability is a central concern. Recommending the largest possible system may be technically valid but financially unrealistic. Similarly, recommending a system based only on budget may produce insufficient savings or an impractical configuration.

Kahayag Energy addresses this by balancing roof capacity, electricity demand, and budget within one guided assessment.

The broader technical proposal describes a future system using Philippine-specific solar data, geospatial processing, machine-learning yield prediction, financial simulation, and AI-generated reports. The hackathon MVP narrows this into a deterministic, user-facing pre-feasibility product that demonstrates the core value proposition without requiring the full production pipeline.

---

# **3\. Product Goals**

## **3.1 Primary Goal**

Enable a homeowner to determine whether rooftop solar appears financially worthwhile and realistically affordable for their property in under five minutes.

## **3.2 Supporting Goals**

The MVP must:

* Make the assessment specific to the selected property.  
* Show how many panels may fit on the roof.  
* Estimate household electricity demand from the monthly bill.  
* Allow users to enter an available upfront budget.  
* Allow users to continue without knowing their budget.  
* Estimate the cost range required for a suitable system.  
* Recommend a system based on roof capacity, demand, and affordability.  
* Recommend a generic panel category rather than a specific brand.  
* Explain why a configuration was recommended.  
* Show estimated installation cost as a range.  
* Show expected savings and payback.  
* Allow users to adjust the panel count.  
* Project the long-term financial outcome of the recommended system.  
* Disclose how confident the estimate is and what data supports it.  
* Generate a contractor-ready PDF report.  
* Make all assumptions and limitations visible.  
* Support residential properties across the Philippines.

## **3.3 User Experience Goals**

The application should be:

* Guided.  
* Understandable without solar expertise.  
* Mobile-responsive.  
* Visually grounded in the user’s actual property.  
* Transparent about assumptions.  
* Transparent about price uncertainty.  
* Clear about the difference between an estimate and a professional assessment.  
* Focused on one decision:

Does solar appear worth further investigation for this property, and what configuration may fit the homeowner’s roof, needs, and budget?

---

# **4\. Success Criteria**

The MVP is successful when a first-time user can:

* Locate a property in the Philippines.  
* Trace the usable roof area.  
* Enter an average monthly electricity bill.  
* Enter a budget or request an estimate.  
* Receive a recommended panel configuration.  
* Understand the estimated cost range.  
* Understand the expected monthly savings.  
* Understand the estimated payback period.  
* Generate a report.  
* Complete the full process in under five minutes.

## **4.1 Validation Metrics**

| Metric | Target |
| ----- | ----- |
| Median assessment completion time | Under 5 minutes |
| Users completing the full flow | At least 80% |
| Users identifying the recommended system correctly | At least 90% |
| Users identifying the estimated cost range correctly | At least 90% |
| Users identifying estimated monthly savings correctly | At least 90% |
| Users identifying estimated payback correctly | At least 90% |
| Users understanding that costs are estimates | At least 90% |
| Successful PDF generation | At least 95% |
| Critical errors during final demo | Zero |

These are MVP usability targets rather than validated market metrics.

---

# **5\. Non-Goals**

The MVP will not:

* Replace a licensed engineer or contractor assessment.  
* Evaluate roof structural strength.  
* Produce construction-ready engineering plans.  
* Guarantee system performance.  
* Guarantee savings or payback.  
* Guarantee contractor pricing.  
* Guarantee that the entered budget is sufficient.  
* Train or deploy a production-grade machine-learning yield model.  
* Provide live contractor quotations.  
* Recommend specific contractors.  
* Recommend specific solar brands or models.  
* Verify contractor inventory.  
* Process payments.  
* Offer financing applications.  
* Calculate loan interest or repayment schedules.  
* Include battery storage in the primary recommendation.  
* Support off-grid or hybrid system design.  
* Present side-by-side alternative system configurations.  
* Model net-metering export credits.  
* Require user accounts.  
* Save assessments between sessions.  
* Maintain assessment history.  
* Provide an AI chatbot.  
* Support commercial or industrial-scale systems.  
* Automatically read uploaded electricity bills.  
* Provide legal, regulatory, or net-metering advice.  
* Track system performance after installation.

---

# **6\. Target Users**

## **6.1 Primary User**

### **Philippine Homeowner Considering Rooftop Solar**

The primary user:

* Owns or helps manage a residential property.  
* Is interested in lowering electricity expenses.  
* Has limited or moderate knowledge of solar systems.  
* Knows their approximate monthly electricity bill.  
* May have an upfront budget.  
* May not know what a suitable system should cost.  
* Wants an initial estimate before speaking with installers.  
* May be concerned about inconsistent contractor recommendations.  
* Wants a clear financial explanation rather than a technical engineering report.

## **6.2 User Needs**

The homeowner needs to understand:

* Whether the roof appears suitable in size.  
* How many panels may fit.  
* Which generic panel category may be appropriate.  
* What system size may match household demand.  
* Whether the system may fall within the available budget.  
* What budget range may be required.  
* How much electricity the system may generate.  
* How much the installation may cost.  
* How much the household may save.  
* How long the investment may take to recover.  
* Why the system was recommended.  
* Which constraint limited the recommendation: roof area, electricity demand, or budget.  
* What the investment may look like over the life of the system.  
* What assumptions may affect the estimate.  
* What information should be verified by a contractor.

## **6.3 Secondary Report Recipient**

Solar contractors may receive the generated PDF from the homeowner.

The report should therefore present the property, roof area, budget, recommended system, calculations, and assumptions consistently.

The MVP will not include a contractor portal or contractor-specific workflow.

---

# **7\. Product Principles**

## **7.1 Affordability Is a Core Constraint**

The system must not recommend a configuration based only on maximum roof capacity.

It must consider:

* Roof capacity.  
* Electricity demand.  
* Budget.

## **7.2 Use Cost Ranges**

The application must show estimated installation costs as ranges.

Example:

Estimated installation cost: ₱220,000–₱270,000

A midpoint may be used internally for calculations, but the range must remain the primary user-facing value.

## **7.3 Explain Uncertainty**

The application must explain that cost may vary because of:

* Contractor pricing.  
* Panel and inverter brand.  
* Installation complexity.  
* Roof condition.  
* Labor and transport.  
* Location.  
* Permits.  
* Electrical upgrades.  
* Structural work.

## **7.4 Use Plain Language**

Technical terms must be explained or paired with familiar financial outcomes.

Example:

Estimated monthly savings: ₱3,200  
 This is approximately 45% of your current monthly bill.

## **7.5 Keep One Primary Recommendation**

The application presents one configuration. A homeowner comparing options is doing the work the product exists to do for them.

Where the user adjusts that configuration, the adjusted result replaces the recommendation rather than sitting beside it, and the explanation states what changed and why the limits allow it.

## **7.6 Avoid False Precision**

The system must avoid displaying results with unnecessary precision.

Appropriate:

* ₱220,000–₱270,000.  
* Approximately 5.7 years.  
* Around 45% electricity offset.

Inappropriate:

* ₱243,782.19.  
* 5.732 years.  
* 44.83% offset.

Payback is presented as a single rounded figure rather than a range. It is derived from the midpoint installation cost, so a range would imply a precision the cost assumptions do not support. Offset is rounded to whole percentage points.

## **7.7 Separate Estimate From Guarantee**

The system must use preliminary language throughout.

It must not state that:

* The roof is approved.  
* The price is guaranteed.  
* The savings are guaranteed.  
* A contractor will provide the system within the entered budget.

---

# **8\. Recommendation Framework**

## **8.1 Recommendation Inputs**

The recommendation must consider:

| Input | Purpose |
| ----- | ----- |
| Roof polygon | Determines usable area |
| Estimated roof capacity | Establishes maximum panel count |
| Monthly electricity bill | Estimates household demand |
| Available budget | Establishes affordability constraint |
| Panel category | Defines assumed dimensions, wattage, and cost |
| Location solar resource | Supports generation estimate |
| Fixed cost assumptions | Supports installation-cost range |

Each constraint yields a maximum panel count. The recommendation takes the smallest of the three. The constraint that produced it is recorded as the **limiting constraint** and drives the explanation shown to the user.

Where two constraints tie, the recommendation resolves toward the one the household controls most directly: budget first, then demand, then roof area.

## **8.2 Recommendation When Budget Is Provided**

The system should recommend a configuration that:

* Fits within the selected roof area.  
* Has a cost range reasonably compatible with the entered budget.  
* Does not substantially exceed estimated household demand.  
* Uses a suitable panel category.  
* Meets the minimum practical system size.

Recommended wording:

Based on current assumptions, this configuration may fit within your stated budget.

The application must not say:

This system definitely fits your budget.

## **8.3 Recommendation When No Budget Is Provided**

The system should:

* Recommend a system based on roof capacity and estimated demand.  
* Avoid unnecessary overproduction.  
* Estimate the budget range required.  
* Explain that the user may need approximately that amount before speaking with contractors.

## **8.4 Recommendation Explanation**

The results must explain why the configuration was selected.

Example:

This configuration was recommended because it fits your available roof area, may offset a significant portion of your electricity use, and appears compatible with your stated budget under the current cost assumptions.

## **8.5 Adjusting the Recommendation**

The MVP presents one configuration rather than a set of alternatives. The user explores the trade-off by changing the panel count directly, which recalculates cost, generation, savings, payback, and offset.

Roof area and budget remain hard limits on an adjustment. Electricity demand does not: a user may deliberately size past their own consumption, in which case savings stay capped at what the household actually uses and the explanation says so.

---

# **9\. Panel Categories**

The MVP will use generic panel categories rather than specific brands.

| Category | Wattage | Dimensions | Primary Purpose | Trade-off |
| ----- | ----- | ----- | ----- | ----- |
| Standard | 450 W | 1.13 m × 1.76 m | Lower upfront cost | Requires more roof area for equivalent capacity |
| High-output | 550 W | 1.13 m × 1.76 m | Greater capacity from the same footprint | Higher estimated cost |

Standard is the default. Both categories share a footprint, so the choice trades cost against capacity rather than cost against roof space. Cost is derived per kilowatt-peak, not per panel, so it follows from the category's wattage rather than from a separate price table.

Panel dimensions and wattage are defined once, in the backend's central assumptions module. See [calculations_guide.md](calculations_guide.md) for the values and how they enter each calculation.

The application must state that:

* These are simplified planning categories.  
* They do not represent specific products.  
* Contractors may recommend different models.  
* Actual specifications, warranties, prices, and availability may vary.

---

# **10\. Estimated Cost Scope**

The estimate represents a typical grid-tied package. Inclusions and exclusions are published to the user verbatim, so the lists stay short enough to read on a phone and are held in one place in the backend rather than restated per screen.

## **10.1 Typical Inclusions**

* Solar panels.  
* Inverter.  
* Standard installation.

## **10.2 Potential Exclusions**

* Roof repairs.  
* Electrical upgrades.  
* Permits.

Anything a contractor may charge for that is not named as an inclusion should be assumed excluded. Battery storage, hybrid and off-grid equipment, structural reinforcement, financing interest, and premium equipment are outside the estimate entirely, since the MVP does not size or price them.

Both lists must appear on the results screen and in the PDF report.

---

# **11\. Primary User Journey**

## **Step 1: Start Assessment**

The homeowner opens the landing page and sees:

* Product value proposition.  
* Expected completion time.  
* Main outputs.  
* Preliminary-assessment disclaimer.  
* Cost-estimate disclaimer.  
* **Assess My Roof** button.

No account is required.

## **Step 2: Locate Property**

The homeowner searches for an address or moves the map manually.

The application displays satellite imagery and asks the user to confirm the property.

## **Step 3: Define Roof Area**

The homeowner traces the usable roof area.

The application:

* Displays the polygon.  
* Calculates the approximate area.  
* Allows editing, clearing, and redrawing.  
* Prevents continuation when the shape is invalid.

## **Step 4: Enter Electricity and Budget Details**

The homeowner enters an average monthly electricity bill.

The user then selects:

* **I have a budget**, or  
* **Estimate the budget for me**.

When a budget is provided, the system uses it as a recommendation constraint.

When no budget is provided, the system estimates the likely cost range of an appropriate configuration.

## **Step 5: Receive Recommended Layout**

The system evaluates:

* Roof capacity.  
* Estimated demand.  
* Budget.  
* Available panel categories.

The system then recommends:

* Panel category.  
* Panel count.  
* System capacity.  
* Estimated installation-cost range.

Retrieving satellite solar data for the property takes long enough to need its own screen. The application shows assessment progress rather than a blank wait, then moves the user to the results once the calculation resolves.

The recommended panels are automatically placed on the roof.

## **Step 6: View Results**

The homeowner sees:

* Preliminary recommendation.  
* Recommended panel category.  
* Panel count.  
* System capacity.  
* Estimated installation-cost range.  
* Estimated generation.  
* Electricity-demand offset.  
* Monthly and annual savings.  
* Estimated payback.  
* Budget compatibility.  
* Reason for recommendation, naming the limiting constraint.  
* Shading impact on the roof, where satellite data was available.

The user may adjust the panel count and see every figure update.

## **Step 7: Explore the Investment**

The homeowner opens a long-term projection of the recommended system: cumulative savings against the upfront cost over the life of the system, accounting for panel degradation and rising electricity prices.

A separate view explains how much confidence the estimate carries and which data each part of it rests on, so the homeowner can judge what to verify with a contractor.

## **Step 8: Generate Report**

The user selects **Generate Contractor Report**.

The AI writes the plain-language framing. Every number in the report is substituted by the application from validated values, so the AI cannot recalculate or restate a figure.

## **Step 9: Review and Download**

The user previews and downloads the PDF, and is told the assessment is not saved.

The user may return to the results, adjust the configuration, and regenerate the report.

No assessment is saved after the session ends.

---

# **12\. Functional Requirements**

## **12.1 Landing Page**

The system must:

* Display the product name and value proposition.  
* State that the process takes under five minutes.  
* Explain the main outputs.  
* Provide an **Assess My Roof** button.  
* Display preliminary-assessment and cost-estimate disclaimers.  
* Support desktop and mobile layouts.

### **Acceptance Criteria**

* The user can begin with one click.  
* No authentication is required.  
* The main action is immediately visible.

---

## **12.2 Property Search and Map**

The system must:

* Display an interactive Philippine map.  
* Support address or place search.  
* Allow zooming and panning.  
* Display satellite imagery.  
* Identify the selected property.  
* Allow confirmation or correction.  
* Prevent continuation without a selected property.

### **Error States**

* Address not found.  
* Incomplete address match.  
* Map unavailable.  
* Satellite imagery unavailable.  
* Location outside the Philippines.

---

## **12.3 Roof Boundary Selection**

The system must:

* Allow polygon drawing.  
* Display the selected polygon.  
* Calculate approximate roof area.  
* Allow editing, clearing, and redrawing.  
* Validate the polygon.  
* Support one roof polygon in the MVP.

The user should be instructed to:

* Trace only usable roof area.  
* Exclude visible obstructions.  
* Avoid including neighboring structures.

Only the area the user traces is treated as usable. The application applies no further derate for spacing or obstructions, because doing so would silently shrink a boundary the user was explicitly asked to draw conservatively.

### **Error States**

* Incomplete polygon.  
* Degenerate shape: duplicate or collinear points enclosing no area.  
* Self-intersecting shape.  
* Area too small to fit a single panel.

---

## **12.4 Electricity Input**

The system must require:

* Average monthly electricity bill in Philippine pesos.

The system must:

* Accept numeric values.  
* Reject zero, negative, or invalid values.  
* Apply practical minimum and maximum limits.  
* Explain that a typical monthly bill should be used.  
* Display the assumed electricity rate.

The user will not be required to enter technical consumption data.

Household consumption is derived by dividing the monthly bill by an assumed electricity rate. That rate is a single national default, and it is shown to the user because it drives both the consumption estimate and the savings figure.

The interface may accept a known electricity rate or a known monthly consumption in kilowatt-hours. Where consumption is supplied directly it is used as given, and the bill is not converted. Neither field is required.

---

## **12.5 Budget Input**

Budget must be optional.

The system must offer:

* **I have a budget**  
* **Estimate the budget for me**

When the user provides a budget, the system must:

* Accept a Philippine peso amount.  
* Validate the input.  
* Use the value as a recommendation constraint.  
* Explain that contractor quotations may exceed it.

When the user does not provide a budget, the system must:

* Continue normally.  
* Recommend a configuration based on roof and demand.  
* Estimate the budget range required.

---

## **12.6 Insufficient Budget Handling**

The minimum supported configuration is one panel. If the entered budget does not cover even that, the system must:

* Avoid recommending an unrealistic system.  
* Display the one-panel configuration as the smallest estimate available.  
* Show its estimated cost range.  
* Show the approximate budget gap against the low end of that range.  
* Allow the user to revise the budget.  
* Allow the user to continue using the estimated-budget path.

A budget shortfall does not block the assessment. The result is returned with the gap stated plainly, so the homeowner learns what the entry point actually costs.

Example message:

Your entered budget is below the estimated cost range for the minimum supported grid-tied solar system. Consider increasing your budget or discussing financing options with a contractor.

The MVP must not calculate financing or loans.

---

## **12.7 Panel Recommendation**

The system must recommend:

* Generic panel category.  
* Panel count.  
* System capacity.  
* Estimated cost range.

The recommendation must consider:

* Roof area.  
* Estimated electricity demand.  
* Budget.  
* Minimum practical system size.

The system must explain why the category and count were selected, and must name the constraint that limited the result. The explanation must also state what the other two constraints would have allowed, so the homeowner can see what changing their budget or their roof selection would buy them.

---

## **12.8 Automatic Panel Placement**

The system must:

* Place panels inside the roof polygon.  
* Calculate a maximum estimated panel count.  
* Use the recommended count as the initial layout.  
* Prevent panels from extending outside the polygon.  
* Show the current count.  
* Allow increment and decrement.  
* Disable invalid controls.  
* Recalculate results when the count changes.

The MVP may use simplified geometric packing.

It does not need to:

* Perform structural analysis.  
* Detect every obstruction.  
* Optimize tilt.  
* Guarantee installer-approved spacing.

Where satellite solar data covers the property, the application does resolve roof segments and their pitch, azimuth, and sunlight retention. This informs the generation estimate and the shading summary; it does not make the layout an engineering plan.

---

## **12.9 Solar and Financial Calculation**

The system must calculate:

* Panel count.  
* Panel category.  
* System capacity.  
* Estimated annual generation.  
* Estimated monthly generation.  
* Estimated demand offset.  
* Estimated installation-cost range.  
* Estimated monthly savings.  
* Estimated annual savings.  
* Estimated payback.

The calculator must be deterministic.

The same input must produce the same output.

The LLM must not calculate any technical or financial value.

### **Calculation Relationships**

1. Panel category defines assumed wattage and dimensions.  
2. Panel count defines system size.  
3. System size and the location's solar resource determine generation.  
4. Generation is compared with estimated demand to produce the offset.  
5. Savings follow from the electricity the household actually displaces, valued at the electricity rate.  
6. System size and cost assumptions determine the installation range.  
7. Midpoint cost and annual savings determine payback.

Savings are capped at household consumption. A system generating more than the home uses earns nothing for the surplus, because the MVP does not model export credits. This is what stops an oversized system from showing implausible returns.

Payback is undefined rather than infinite when annual savings are zero, and is presented as unavailable rather than as a number.

[calculations_guide.md](calculations_guide.md) is the authoritative specification for every formula, constant, and rounding rule. This document states intent; that one states arithmetic. Where they disagree, the calculation guide governs.

### **Solar Resource**

Generation must not rest on a single national figure where better data exists.

* Where a satellite solar data provider covers the property, generation uses the sunlight hours measured for that roof, reduced by observed shading.  
* Where it does not, the calculation falls back to a nationwide peak-sun-hour assumption.

The result must record which source was used, and the fallback must surface as a stated limitation on the results screen and in the report. A user must never have to guess whether their number came from their roof or from a national average.

### **Required Assumptions**

The interface must provide access to:

* Panel wattage.  
* Panel dimensions.  
* Cost-per-kilowatt range.  
* Electricity rate.  
* Annual sunlight hours per kilowatt-peak, and its source.  
* Peak sun hours per day.  
* Performance ratio covering standard system losses.  
* Cost inclusions.  
* Potential cost exclusions.

---

## **12.10 Investment Projection**

Payback alone understates the decision, because it stops at the break-even year and ignores the decades after it.

The system must therefore project the recommended configuration over the analysis period and show:

* Cumulative savings against the upfront cost.  
* The year the investment breaks even.  
* Declining output as the panels age.  
* Rising electricity prices over the period.

The projection must be labelled as a projection, and its escalation and degradation assumptions must be visible. It must not be presented as a forecast of actual returns.

### **Confidence and Data Provenance**

The system must explain how much confidence the estimate carries and which data supports each part of it: roof geometry, solar irradiance, shading, and local grid data.

This exists so a homeowner can tell a well-supported figure from a coarse one, and knows what to ask a contractor to verify.

---

## **12.11 Results Dashboard**

The results screen must prioritize:

1. Preliminary recommendation.  
2. Recommended configuration.  
3. Estimated cost range.  
4. Estimated monthly savings.  
5. Estimated payback.  
6. Panel layout.

The screen must display:

* Property map.  
* Panel layout.  
* Panel category.  
* Panel count.  
* System capacity.  
* Annual generation.  
* Demand offset.  
* Cost range.  
* Monthly and annual savings.  
* Payback.  
* User budget, when provided.  
* Budget compatibility.  
* Recommendation explanation and limiting constraint.  
* Shading impact, where satellite data was available.  
* Assumptions.  
* Cost inclusions.  
* Potential exclusions.  
* Limitations.  
* **Generate Contractor Report** button.

Every assessment is marked preliminary in the response itself, not only in interface copy, so no downstream screen or report can present it as settled.

### **Recommendation States**

* Promising solar candidate.  
* Potentially viable.  
* May require further assessment.  
* Budget may be insufficient.

### **Prohibited Claims**

The interface must not say:

* Roof approved for solar.  
* Guaranteed savings.  
* Guaranteed payback.  
* Guaranteed installation price.  
* Guaranteed budget compatibility.

---

## **12.12 Configuration Changes**

The user must be able to:

* Change panel count.  
* Return to the budget screen.  
* Return to roof selection.

A panel-count change is recalculated by the same deterministic rules as the original recommendation, not by adjusting the previous result. Roof area and budget are enforced as hard limits and a change violating either must be rejected with the reason. Exceeding estimated demand is permitted, with savings capped and the cap explained.

When the configuration changes, the system must update:

* Capacity.  
* Generation.  
* Cost range.  
* Savings.  
* Payback.  
* Demand offset.  
* Budget compatibility.

Any previously generated report must be marked outdated.

---

## **12.13 AI Report Generation**

The AI report must use validated structured data.

The payload should include:

* Property location.  
* Roof area.  
* Panel category.  
* Panel count.  
* System capacity.  
* Generation.  
* Demand offset.  
* Cost range.  
* Savings.  
* Payback.  
* Electricity bill.  
* Budget.  
* Budget compatibility.  
* Assumptions.  
* Cost inclusions.  
* Cost exclusions.  
* Recommendation.  
* Limitations.

The AI must:

* Explain results in plain language.  
* Avoid unsupported findings.  
* Avoid structural claims.  
* Avoid guaranteed pricing or savings.  
* Avoid naming brands or contractors.  
* Recommend professional verification.

### **Value Preservation**

Instructing a model to preserve values is not a control, because nothing checks it. The MVP therefore removes the model's ability to state a number at all.

The AI returns prose containing named placeholders. The application substitutes the validated values into those placeholders. Any response that references an unknown placeholder, leaves one unfilled, malforms the syntax, or exceeds the length limit is discarded whole.

Discarded output is replaced by deterministic template text, never by partially trusted AI output. A report whose AI generation failed must remain a complete and correct report.

If the AI provider is unconfigured or unavailable, the system must use the same template-based report.

---

## **12.14 PDF Export**

The PDF must include:

* Kahayag Energy branding.  
* Assessment date.  
* Property location.  
* Roof-layout image.  
* Roof-area estimate.  
* Recommended panel category.  
* Panel count.  
* System capacity.  
* Generation.  
* Cost range.  
* Budget, when provided.  
* Budget compatibility.  
* Savings.  
* Payback.  
* Recommendation explanation.  
* Assumptions.  
* Cost inclusions.  
* Potential exclusions.  
* Limitations.  
* Next steps.

The system must:

* Provide PDF preview.  
* Generate an A4-readable document.  
* Preserve all values.  
* Use a descriptive filename.  
* Require no account or email.

Example:

`Kahayag-Solar-Assessment-2026-07-23.pdf`

---

## **12.15 Session Behavior**

The application must not require an account.

Assessment data may be retained temporarily during the active session.

The application must not imply that data will remain available after:

* Refreshing the page.  
* Closing the browser.  
* Session expiration.

The user should be encouraged to download the report before leaving.

---

# **13\. User Stories**

## **Property and Roof**

* As a homeowner, I want to search for my address so I can assess my property.  
* As a homeowner, I want satellite imagery so I can identify my roof.  
* As a homeowner, I want to trace the usable roof area so the estimate reflects my home.  
* As a homeowner, I want to edit the boundary if I make a mistake.

## **Electricity and Budget**

* As a homeowner, I want to enter my monthly bill instead of technical consumption values.  
* As a homeowner, I want to enter my budget so the recommendation reflects what I may afford.  
* As a homeowner, I want to continue without a budget so I can learn how much I may need.  
* As a homeowner, I want to see a range rather than one exact price.  
* As a homeowner, I want to know when my budget may be insufficient.

## **Recommendation and Layout**

* As a homeowner, I want the system to recommend a panel category.  
* As a homeowner, I want the recommendation to consider my roof, bill, and budget.  
* As a homeowner, I want to understand why the system was selected.  
* As a homeowner, I want the panels placed automatically.  
* As a homeowner, I want to increase or decrease the panel count.

## **Results and Long-Term Outlook**

* As a homeowner, I want to see estimated monthly savings.  
* As a homeowner, I want to see the expected cost range.  
* As a homeowner, I want to see the estimated payback.  
* As a homeowner, I want to see what the system may return over its full life, not only when it breaks even.  
* As a homeowner, I want to know which constraint limited my recommendation so I know what to change.  
* As a homeowner, I want to know how much to trust the estimate and what a contractor should verify.  
* As a homeowner, I want to understand what the estimate includes and excludes.

## **Report**

* As a homeowner, I want a contractor-ready report.  
* As a homeowner, I want the report to preserve the same values shown in the app.  
* As a homeowner, I want to download the report without registering.  
* As a homeowner, I want the report to explain its limitations.

---

# **14\. Screen Descriptions**

| Screen | Purpose | Main Elements | Primary Action |
| ----- | ----- | ----- | ----- |
| Landing Page | Explain the product | Value proposition, process overview, disclaimers | Assess My Roof |
| Property Selection | Locate the home | Search, satellite map, property marker | Confirm Property |
| Roof Selection | Define usable area | Polygon tool, area estimate, edit controls | Continue |
| Electricity and Budget | Collect financial inputs | Monthly bill, budget choice, budget field | Recommend My Solar System |
| Assessment Progress | Cover the solar-data retrieval | Progress state, fallback behavior | Automatic |
| Results Dashboard | Explain viability and affordability | Recommendation, savings, payback, shading, assumptions | Generate Contractor Report |
| Layout Editor | Adjust the system | Panel layout, panel count controls, live recalculation | Apply |
| Investment Projection | Show the long-term outcome | Cumulative savings, break-even year, projection assumptions | Continue |
| Confidence Breakdown | Justify the estimate | Confidence score, per-factor data sources | Continue |
| Project Brief | Summarize for a contractor | Property, roof, system, financial summary | Generate Report |
| Report Preview | Review and export | PDF preview, disclaimers, download | Download PDF |
| Report Saved | Confirm the download | Confirmation, session-loss warning | Start Over |

---

# **15\. Development Phases**

## **Phase 1: Property and Roof Selection**

### **Scope**

* Landing page.  
* Philippine-wide map.  
* Address search.  
* Satellite imagery.  
* Property confirmation.  
* Roof polygon drawing.  
* Editing and clearing.  
* Area calculation.  
* Validation.

### **Completion Criteria**

The user can locate a property, trace a roof, and receive an area estimate.

---

## **Phase 2: Electricity, Budget, Recommendation, and Layout**

### **Scope**

* Monthly bill input.  
* Optional budget input.  
* Estimated-budget path.  
* Input validation.  
* Fixed panel categories.  
* Fixed cost assumptions.  
* Demand estimation.  
* Roof-capacity calculation.  
* Budget evaluation.  
* Panel-category recommendation.  
* Panel-count recommendation.  
* Automatic placement.  
* Increment and decrement controls.  
* Deterministic calculations.  
* Insufficient-budget state.

### **Completion Criteria**

The user can enter financial information and receive a recommended configuration with an estimated cost range.

---

## **Phase 3: Results and AI Report**

### **Scope**

* Results dashboard.  
* Recommendation explanation and limiting constraint.  
* Budget compatibility.  
* Cost range.  
* Savings and payback.  
* Location solar resource with nationwide fallback.  
* Shading summary.  
* Investment projection.  
* Confidence breakdown.  
* Assumptions and limitations.  
* Cost inclusions and exclusions.  
* Panel-count adjustment.  
* AI report generation.  
* Placeholder substitution and rejection rules.  
* Template fallback.

### **Completion Criteria**

The user can understand the result, judge the long-term outcome, and generate a consistent report.

---

## **Phase 4: PDF and End-to-End Refinement**

### **Scope**

* PDF preview.  
* PDF generation.  
* Roof-layout image capture.  
* Download behavior.  
* Responsive review.  
* Loading and error states.  
* Demo fallback.  
* Accessibility improvements.  
* Performance optimization.  
* End-to-end testing.

### **Completion Criteria**

A first-time user can finish the assessment and download a report in under five minutes.

---

# **16\. Risks and Mitigations**

| Risk | Impact | Mitigation |
| ----- | ----- | ----- |
| Satellite image is unclear | Incorrect roof selection | Allow zooming, editing, and redrawing |
| Roof geometry is oversimplified | Panel count may be overstated | Use conservative spacing and clear disclaimers |
| Satellite solar data is unavailable for a property | Generation rests on a national average | Fall back to the nationwide assumption, record the source, and state it as a limitation |
| Shading is not detected | Generation may be overstated | Use measured roof sunlight where available; otherwise apply the system-loss assumption and state the limitation |
| Regional prices vary | Cost range may be inaccurate | Show ranges and centralized assumptions |
| User treats estimate as quotation | Misleading price expectation | Label all prices as estimates |
| User assumes budget is guaranteed | Incorrect affordability expectation | Use “may fit” language |
| Panel category is mistaken for a product | Incorrect product expectation | Use generic categories and avoid brands |
| Budget dominates recommendation | System may be ineffective | Enforce minimum practical size |
| Roof capacity dominates recommendation | System may be oversized | Compare output with estimated demand |
| Multiple configurations confuse users | Harder decision | Present one recommendation and let the user adjust it |
| Projection is read as a forecast | Overconfident financial expectation | Label it a projection and expose its assumptions |
| User treats result as engineering approval | Unsafe reliance | Repeat preliminary-assessment disclaimer |
| AI changes values | Inconsistent report | Let the AI emit placeholders only, substitute values in the application, and discard any non-conforming response |
| Map or AI service fails | Demo interruption | Prepare known demo property and fallback |
| Five-minute goal is missed | Poor usability | Minimize fields and test timed flow |

---

# **17\. Assumptions**

The MVP assumes:

* The property is residential and located in the Philippines.  
* The user can identify and trace the roof.  
* One roof polygon is sufficient.  
* The user knows their approximate monthly bill.  
* Budget is optional.  
* Entered budget is approximate.  
* Fixed panel categories are acceptable.  
* Fixed financial assumptions are acceptable for the hackathon.  
* A single national electricity-rate default is acceptable when the user does not supply their own.  
* The traced area is the usable area, with no further derate applied.  
* Cost ranges are preferable to exact prices.  
* Simplified panel packing is sufficient.  
* Satellite solar coverage is uneven, and a nationwide fallback is acceptable where it is absent.  
* Savings stop at household consumption, since export credits are not modelled.  
* The system is grid-tied and excludes batteries.  
* Financing calculations are excluded.  
* The recommendation is preliminary.  
* Contractor prices may differ.  
* No account or persistent storage is required.  
* The report is downloaded during the active session.  
* AI contributes wording only, never values.  
* Nationwide support does not imply equal imagery or data quality.  
* Contractors may recommend different products and system sizes.

---

# **18\. Open Product Decisions**

### **Decided**

These are fixed in [calculations_guide.md](calculations_guide.md) and the backend's central assumptions module. Changing one is a deliberate product decision, not an implementation detail.

1. Wattage and dimensions per panel category.  
2. Usable roof area equals the traced area; no spacing factor or planning derate is applied.  
3. Electricity-rate default.  
4. Lower, midpoint, and upper cost-per-kilowatt-peak assumptions.  
5. Solar-generation factor, sourced per location with a nationwide fallback.  
6. Standard system-loss assumption, expressed as a performance ratio.  
7. Minimum practical system size: one panel.  
8. Budget compatibility: the low end of the cost range must not exceed the budget.  
9. Overproduction: permitted on manual adjustment, with savings capped at consumption.  
10. Payback: a single figure from the midpoint cost, undefined when savings are zero.  
11. Cost inclusions and exclusions.

### **Open**

These remain unresolved and must be settled before launch:

1. Bill input limits.  
2. Budget input limits.  
3. Exact disclaimer text.  
4. Temporary data-retention behavior.  
5. Confidence-scoring inputs and weighting.  
6. Electricity-price escalation and panel-degradation rates used by the investment projection.

---

# **19\. MVP Definition of Done**

The MVP is complete when:

* The user can begin without authentication.  
* The user can locate a Philippine property.  
* The user can trace a usable roof area.  
* The user can enter a monthly electricity bill.  
* The user can enter a budget or request an estimate.  
* The system recommends a panel category and count.  
* The system generates an automatic panel layout.  
* The user can adjust the panel count.  
* The system shows an estimated installation-cost range.  
* The system explains budget compatibility.  
* The system handles insufficient budgets appropriately.  
* The system produces deterministic savings and payback estimates.  
* The system states which constraint limited the recommendation.  
* The system discloses whether the generation estimate came from the property or from a nationwide fallback.  
* The user can review a long-term investment projection.  
* The system generates a contractor-ready report.  
* The report preserves all values and ranges.  
* The user can download the report as a PDF.  
* The product clearly states that results are preliminary.  
* The full flow can be completed reliably in under five minutes.