"use client";

import { BASELINE_STUDY_ID } from "@/config/studies";
import { listSurveyDrafts } from "@/lib/offline-drafts";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { SurveyStatus } from "@/lib/survey/types";

export interface OperationalRecord {
  id: string;
  studyId: string;
  status: SurveyStatus;
  sampleGroup: string;
  district: string;
  block: string;
  fpo: string;
  village: string;
  latitude: number | null;
  longitude: number | null;
  gpsAccuracy: number | null;
  enumeratorId: string;
  enumeratorName: string;
  updatedAt: string;
  submittedAt: string | null;
  reviewNote: string;
  answers: Record<string, unknown>;
  source: "central" | "device";
}

export async function loadOperationalRecords(options: { testMode: boolean; userId?: string }): Promise<{ records: OperationalRecord[]; warning: string }> {
  const localDrafts = await listSurveyDrafts().catch(() => []);
  const client = getSupabaseBrowserClient();
  let warning = "";
  let central: OperationalRecord[] = [];

  if (client && !options.testMode && options.userId) {
    const full = await client.from("survey_submissions").select("id, client_generated_id, study_id, status, study_group, district, block, fpo_cluster, village, latitude, longitude, gps_accuracy_meters, enumerator_id, created_at, updated_at, submitted_at, review_note").order("updated_at", { ascending: false });
    const fallback = full.error ? await client.from("survey_submissions").select("id, client_generated_id, status, study_group, district, block, fpo_cluster, village, latitude, longitude, gps_accuracy_meters, enumerator_id, created_at, updated_at, submitted_at, review_note").order("updated_at", { ascending: false }) : null;
    const submissionRows = full.error ? (fallback?.data ?? []).map((row) => ({ ...row, study_id: BASELINE_STUDY_ID })) : (full.data ?? []);
    const submissionError = full.error ? fallback?.error : full.error;
    if (submissionError) warning = submissionError.message;

    const ids = submissionRows.map((row) => row.id);
    const enumeratorIds = [...new Set(submissionRows.map((row) => row.enumerator_id).filter(Boolean))];
    const [payloadResult, profileResult] = await Promise.all([
      ids.length ? client.from("survey_submission_payloads").select("submission_id, answers").in("submission_id", ids) : Promise.resolve({ data: [], error: null }),
      enumeratorIds.length ? client.from("profiles").select("id, display_name").in("id", enumeratorIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (!warning && payloadResult.error) warning = payloadResult.error.message;
    const answersBySubmission = new Map((payloadResult.data ?? []).map((row) => [row.submission_id, asObject(row.answers)]));
    const profileNames = new Map((profileResult.data ?? []).map((row) => [row.id, row.display_name]));
    central = submissionRows.map((row) => ({
      id: String(row.client_generated_id ?? row.id), studyId: String(row.study_id ?? BASELINE_STUDY_ID), status: row.status as SurveyStatus,
      sampleGroup: row.study_group ?? "", district: row.district ?? "", block: row.block ?? "", fpo: row.fpo_cluster ?? "", village: row.village ?? "",
      latitude: finiteOrNull(row.latitude), longitude: finiteOrNull(row.longitude), gpsAccuracy: finiteOrNull(row.gps_accuracy_meters), enumeratorId: row.enumerator_id,
      enumeratorName: profileNames.get(row.enumerator_id) ?? "Assigned field user", updatedAt: row.updated_at ?? row.created_at,
      submittedAt: row.submitted_at ?? null, reviewNote: row.review_note ?? "", answers: answersBySubmission.get(row.id) ?? {}, source: "central",
    }));
  }

  const centralIds = new Set(central.map((record) => record.id));
  const local: OperationalRecord[] = localDrafts.filter((draft) => !centralIds.has(draft.id)).map((draft) => {
    const answers = asObject(draft.sectionData.answers);
    const gps = findGps(answers);
    return {
      id: draft.id, studyId: draft.studyId ?? BASELINE_STUDY_ID, status: draft.status, sampleGroup: textValue(answers["1.4"]), district: textValue(answers["1.5"]),
      block: textValue(answers["1.6"]), fpo: textValue(answers["1.7"] ?? answers["11.1"]), village: textValue(answers["1.8"]), latitude: finiteOrNull(gps?.latitude),
      longitude: finiteOrNull(gps?.longitude), gpsAccuracy: finiteOrNull(gps?.accuracy), enumeratorId: options.userId ?? "local-device", enumeratorName: "Current device user",
      updatedAt: draft.updatedAt, submittedAt: null, reviewNote: draft.reviewNote ?? "", answers, source: "device",
    };
  });
  return { records: [...central, ...local].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), warning };
}

export function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function numeric(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") return Number(value) || 0;
  if (value && typeof value === "object" && !Array.isArray(value)) return numeric((value as Record<string, unknown>).value);
  return 0;
}

export function totalHouseholdIncome(answers: Record<string, unknown>) {
  if (numeric(answers["2.3"])) return numeric(answers["2.3"]);
  const rows = Array.isArray(answers["2.2"]) ? answers["2.2"] as Array<Record<string, unknown>> : [];
  return rows.reduce((sum, row) => sum + numeric(row["2.2b"]), 0);
}

export function householdSize(answers: Record<string, unknown>) {
  return Array.isArray(answers["1A"]) ? answers["1A"].length : 0;
}

export function focusCropNames(answers: Record<string, unknown>): string[] {
  const detailed = Array.isArray(answers["3B.2"]) ? answers["3B.2"] as Array<Record<string, unknown>> : [];
  const fromDetailed = detailed.map((row) => textValue(row.cropName)).filter(Boolean);
  if (fromDetailed.length) return [...new Set(fromDetailed)];
  const roster = Array.isArray(answers["3A.1"]) ? answers["3A.1"] as Array<Record<string, unknown>> : [];
  return [...new Set(roster.map((row) => textValue(row["3A.2"] === "Other - Specify" ? row["3A.2a"] : row["3A.2"])).filter(Boolean))];
}

function findGps(answers: Record<string, unknown>) {
  const direct = asObject(answers["1.11"] ?? answers["11.7a"]);
  if (direct.latitude !== undefined) return direct;
  for (const value of Object.values(answers)) {
    const candidate = asObject(value);
    if (candidate.latitude !== undefined && candidate.longitude !== undefined) return candidate;
  }
  return undefined;
}

function finiteOrNull(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function textValue(value: unknown) {
  return typeof value === "string" ? value : "";
}
