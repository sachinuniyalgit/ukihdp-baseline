# Questionnaire implementation record

## Instruments

The application keeps the two approved instruments separate:

1. **Household Baseline Survey:** Sections 1-10 plus Enumerator Quality Control.
2. **FPO Institutional Assessment:** Section 11 only.

The current configuration contains 251 fields when repeat-group child fields and expanded matrix items are counted.

## Implemented capabilities

- Required consent gate.
- Treatment and control classification.
- Dependent-location fields prepared for approved master data.
- One-tap GPS capture with accuracy and timestamp.
- Repeatable household member roster.
- Repeatable income-source and government-scheme records.
- Repeatable crop production records and focus-crop status hook.
- Repeatable risk/hazard and climate-adaptation records.
- Conditional processing, credit, insurance, extension, training, food-shortage, contract, climate-advisory, and FPO questions.
- Matrices for gender roles, decision-making, governance, service satisfaction, membership, and financial performance.
- Top-three ranking questions.
- Automatic survey identifier, totals, yield, production-cost total, GPS accuracy, and completeness status.
- Automatic browser draft saving and offline synchronization queue.
- Separate Household and FPO instrument switch.

## Project master data still required

The supplied questionnaire did not contain the following exact master values. They are intentionally not invented:

- District to Block mapping.
- The 16 FPO names and Block/FPO relationships.
- Village lists and Village/FPO relationships.
- Project focus-crop list.
- Crop and variety masters.
- Approved Nali-to-acre conversion factor.
- Approved youth age range.
- Final dietary-diversity protocol confirmation.
- Exact ToR/logframe indicator traceability mapping.

These should be supplied before field deployment. The application clearly marks the affected fields as pending master data while allowing configuration testing to continue.
