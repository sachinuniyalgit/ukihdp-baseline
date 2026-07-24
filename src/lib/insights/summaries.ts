import type { OperationalRecord } from "@/lib/insights/operational-data";
import { focusCropNames, householdSize, totalHouseholdIncome } from "@/lib/insights/operational-data";
import type { StudyDefinition } from "@/lib/studies/types";

export interface StudySummary {
  target: number;
  total: number;
  draft: number;
  pendingSync: number;
  submitted: number;
  underReview: number;
  returned: number;
  approved: number;
  treatment: number;
  control: number;
  completion: number;
  missingGps: number;
  poorGps: number;
  districts: Array<{ name: string; total: number; approved: number }>;
  statuses: Array<{ name: string; value: number; color: string }>;
  focusCrops: Array<{ name: string; households: number }>;
  approvedRecords: OperationalRecord[];
  avgIncome: number;
  avgHouseholdSize: number;
  avgDietaryGroups: number;
  fpoMembers: number;
}

export function summarizeStudy(records: OperationalRecord[], study?: StudyDefinition): StudySummary {
  const approvedRecords = records.filter((record) => record.status === "approved");
  const target = study?.targetSample ?? 0;
  const districtNames = [...new Set([...(study?.geographicCoverage ?? []), ...records.map((record) => record.district).filter(Boolean)])];
  const cropCounts = new Map<string, number>();
  approvedRecords.forEach((record) => focusCropNames(record.answers).forEach((crop) => cropCounts.set(crop, (cropCounts.get(crop) ?? 0) + 1)));
  const avg = (values: number[]) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
  const incomes = approvedRecords.map((record) => totalHouseholdIncome(record.answers)).filter((value) => value > 0);
  const sizes = approvedRecords.map((record) => householdSize(record.answers)).filter((value) => value > 0);
  const dietary = approvedRecords.map((record) => Array.isArray(record.answers["8.3"]) ? record.answers["8.3"].length : 0).filter((value) => value > 0);
  const approved = approvedRecords.length;
  return {
    target, total: records.length, draft: records.filter((record) => record.status === "draft").length,
    pendingSync: records.filter((record) => record.status === "queued").length, submitted: records.filter((record) => record.status === "submitted").length,
    underReview: records.filter((record) => record.status === "under_review").length, returned: records.filter((record) => record.status === "returned").length,
    approved, treatment: approvedRecords.filter((record) => record.sampleGroup.toLowerCase() === "treatment").length,
    control: approvedRecords.filter((record) => record.sampleGroup.toLowerCase() === "control").length,
    completion: target ? Math.min(100, Math.round(approved / target * 1000) / 10) : 0,
    missingGps: records.filter((record) => record.latitude === null || record.longitude === null).length,
    poorGps: records.filter((record) => (record.gpsAccuracy ?? 0) > 50).length,
    districts: districtNames.map((name) => ({ name, total: records.filter((record) => record.district === name).length, approved: approvedRecords.filter((record) => record.district === name).length })),
    statuses: [
      { name: "Approved", value: approved, color: "#48aa6a" },
      { name: "Under review", value: records.filter((record) => record.status === "submitted" || record.status === "under_review").length, color: "#7a5ab4" },
      { name: "Draft / pending", value: records.filter((record) => record.status === "draft" || record.status === "queued").length, color: "#e5a52f" },
      { name: "Returned", value: records.filter((record) => record.status === "returned").length, color: "#e35f57" },
    ],
    focusCrops: [...cropCounts.entries()].map(([name, households]) => ({ name, households })).sort((a, b) => b.households - a.households),
    approvedRecords, avgIncome: avg(incomes), avgHouseholdSize: avg(sizes), avgDietaryGroups: avg(dietary),
    fpoMembers: approvedRecords.filter((record) => record.answers["10A.1"] === "Yes").length,
  };
}
