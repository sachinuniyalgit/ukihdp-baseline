"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { saveStudy } from "@/lib/studies/study-catalog";
import { replaceCachedAssignments } from "@/lib/studies/assignment-cache";
import type { StudyAssignment, StudyDefinition, StudyStatus } from "@/lib/studies/types";
import type { QuestionnaireDefinition } from "@/lib/survey/types";

export async function syncStudyToServer(study: StudyDefinition) {
  const client = getSupabaseBrowserClient();
  if (!client) return { ok: false, message: "Central database is not configured; the study remains safely available on this device." };
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return { ok: false, message: "Use a real approved account to publish the study to the central database." };
  const { error: studyError } = await client.from("studies").upsert({
    id: study.id, code: study.code, full_name: study.fullName, short_name: study.shortName, description: study.description, study_type: study.studyType,
    organisation: study.organisation, study_lead: study.studyLead || null, contact_person: study.contactPerson || null, start_date: study.startDate || null,
    end_date: study.endDate || null, status: study.status, geographic_coverage: study.geographicCoverage, target_sample: study.targetSample,
    treatment_target: study.treatmentTarget ?? null, control_target: study.controlTarget ?? null, created_by: auth.user.id, updated_at: new Date().toISOString(),
  }, { onConflict: "id" });
  if (studyError) return { ok: false, message: `Study saved locally; central publication is pending: ${studyError.message}` };
  if (study.questionnaire) {
    const { error: questionnaireError } = await client.from("questionnaire_versions").upsert({ study_id: study.id, code: study.questionnaireId, version: study.questionnaireVersion, title: study.questionnaire.title, status: "published", published_at: new Date().toISOString(), definition: study.questionnaire, created_by: auth.user.id, updated_at: new Date().toISOString() }, { onConflict: "code,version" });
    if (questionnaireError) return { ok: false, message: `Study saved centrally, but questionnaire publication is pending: ${questionnaireError.message}` };
  }
  const existingAssignment = await client.from("study_assignments").select("id").eq("study_id", study.id).eq("user_id", auth.user.id).eq("role_in_study", "study_manager").maybeSingle();
  if (!existingAssignment.data && !existingAssignment.error) {
    const { error: assignmentError } = await client.from("study_assignments").insert({ study_id: study.id, user_id: auth.user.id, role_in_study: "study_manager", active: true });
    if (assignmentError) return { ok: false, message: `Study and questionnaire are published, but the manager assignment is pending: ${assignmentError.message}` };
  }
  return { ok: true, message: "Study and questionnaire version synchronized to the central database." };
}

export async function refreshAssignedStudyCache() {
  const client = getSupabaseBrowserClient();
  if (!client || !navigator.onLine) return [];
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return [];
  const assignmentResult = await client.from("study_assignments").select("id, study_id, user_id, role_in_study, district, block, fpo, villages, sample_group, assignment_start_date, assignment_end_date, active").eq("user_id", auth.user.id).eq("active", true);
  if (!assignmentResult.error) {
    const assignments = (assignmentResult.data ?? []).map((row) => ({
      id: row.id, studyId: row.study_id, userId: row.user_id, roleInStudy: row.role_in_study, district: row.district ?? undefined,
      block: row.block ?? undefined, fpo: row.fpo ?? undefined, villages: Array.isArray(row.villages) ? row.villages as string[] : [],
      sampleGroup: row.sample_group ?? undefined, startDate: row.assignment_start_date ?? undefined, endDate: row.assignment_end_date ?? undefined, active: row.active,
    })) as StudyAssignment[];
    await replaceCachedAssignments(auth.user.id, assignments);
  }
  const studyResult = await client.from("studies").select("id, code, full_name, short_name, description, study_type, organisation, study_lead, contact_person, start_date, end_date, status, geographic_coverage, target_sample, treatment_target, control_target, created_by, created_at, updated_at").neq("id", "00000000-0000-4000-8000-000000000001");
  if (studyResult.error || !studyResult.data?.length) return [];
  const ids = studyResult.data.map((study) => study.id);
  const questionnaireResult = await client.from("questionnaire_versions").select("study_id, code, version, status, definition").in("study_id", ids).eq("status", "published");
  const cached: StudyDefinition[] = [];
  for (const row of studyResult.data) {
    const version = questionnaireResult.data?.filter((item) => item.study_id === row.id).sort((a, b) => String(b.version).localeCompare(String(a.version)))[0];
    const study: StudyDefinition = {
      id: row.id, code: row.code, fullName: row.full_name, shortName: row.short_name, description: row.description ?? "", studyType: row.study_type,
      organisation: row.organisation, studyLead: row.study_lead ?? "", contactPerson: row.contact_person ?? "", startDate: row.start_date ?? "", endDate: row.end_date ?? "",
      status: row.status as StudyStatus, geographicCoverage: Array.isArray(row.geographic_coverage) ? row.geographic_coverage as string[] : [], targetSample: row.target_sample ?? 0,
      treatmentTarget: row.treatment_target ?? undefined, controlTarget: row.control_target ?? undefined, questionnaireId: version?.code ?? "", questionnaireVersion: version?.version ?? "",
      questionnaireStatus: version ? "published" : "not_imported", questionnaire: version?.definition as QuestionnaireDefinition | undefined,
      createdBy: row.created_by ?? "FieldFlow", createdAt: row.created_at, updatedAt: row.updated_at,
    };
    await saveStudy(study);
    cached.push(study);
  }
  return cached;
}
