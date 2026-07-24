import type { StudyDefinition } from "@/lib/studies/types";

export const BASELINE_STUDY_ID = "00000000-0000-4000-8000-000000000001";

export const baselineStudy: StudyDefinition = {
  id: BASELINE_STUDY_ID,
  code: "UKIHDP-BL",
  fullName: "Baseline Assessment of Farmer Livelihoods, Horticultural Production Systems and Value Chain Development in Uttarakhand Himalaya",
  shortName: "Uttarakhand Horticulture Baseline",
  description: "Household and FPO baseline assessment covering livelihoods, horticultural production, value chains, climate resilience, nutrition, and inclusion.",
  studyType: "Baseline assessment",
  organisation: "UKIHDP",
  studyLead: "Project Study Lead",
  contactPerson: "FieldFlow Administrator",
  startDate: "",
  endDate: "",
  status: "active",
  geographicCoverage: ["Nainital", "Pithoragarh", "Tehri Garhwal", "Uttarkashi"],
  targetSample: 960,
  treatmentTarget: 640,
  controlTarget: 320,
  questionnaireId: "ukihdp-household-baseline",
  questionnaireVersion: "1.1-draft",
  questionnaireStatus: "published",
  createdBy: "FieldFlow migration",
  createdAt: "2026-07-22T00:00:00.000Z",
  updatedAt: "2026-07-22T00:00:00.000Z",
  builtIn: true,
};
