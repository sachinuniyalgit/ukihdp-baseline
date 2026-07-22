import type { QuestionnaireDefinition } from "@/lib/survey/types";

// This is the frozen outline only. Exact questions, options, validation,
// skip logic, recall periods, and indicator mappings will be added later.
export const baselineQuestionnaire: QuestionnaireDefinition = {
  id: "ukihdp-household-baseline",
  title: "UKIHDP Household Baseline Survey",
  version: "outline-1.0",
  status: "draft",
  sections: [
    ["demographic-profile", "Demographic Profile of Sample Households", "Demographics", "Consent, identification, household roster, land, assets, housing, and basic services.", "household"],
    ["financial-profile", "Household Income Sources and Financial Profile", "Income & finance", "Income, expenditure, savings, debt, credit, insurance, schemes, and financial stress.", "household"],
    ["crop-production", "Crop Production Practices - Focus Crops", "Crop production", "All-crop roster, focus crops, inputs, productivity, costs, technology, and adoption potential.", "household"],
    ["inputs-extension", "Access to Inputs and Extension Services", "Inputs & extension", "Availability, quality, affordability, timeliness, training, extension, and digital advice.", "household"],
    ["processing-infrastructure", "Processing Practices and Infrastructure", "Processing", "Sorting, grading, packing, processing, facilities, economics, constraints, and schemes.", "household"],
    ["marketing", "Aggregation, Distribution and Marketing", "Marketing", "Markets, buyers, prices, costs, losses, aggregation, contracts, and information sources.", "household"],
    ["risks", "Risks and Challenges", "Risks", "Natural, production, post-harvest, wildlife, market, and financial risks and coping responses.", "household"],
    ["nutrition", "Household Nutrition Security", "Nutrition", "Food production, dietary diversity, shortage, coping, kitchen gardens, and scheme access.", "household"],
    ["climate-adaptation", "Environmental Sustainability and Climate Adaptation", "Climate adaptation", "Climate exposure, conservation, adaptation practices, advisories, barriers, and preparedness.", "household"],
    ["gender-youth-inclusion", "Gender, Youth and Social Inclusion", "Inclusion", "Roles, decisions, income control, workload, participation, leadership, youth, and FPO linkage.", "household"],
    ["fpo-institutional", "Institutional Mapping and FPO Functioning", "FPO assessment", "A separate institutional tool for governance, membership, business, services, infrastructure, and convergence.", "institutional"],
  ].map(([id, title, shortTitle, description, instrument], index) => ({
    id,
    order: index + 1,
    title,
    shortTitle,
    instrument: instrument as "household" | "institutional",
    description,
    questions: [],
  })),
};
