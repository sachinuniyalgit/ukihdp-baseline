"use client";

import { getSurveyDraft, listSurveyDrafts, updateSurveyDraftStatus, type OfflineSurveyDraft } from "@/lib/offline-drafts";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export interface SyncResult {
  draftId: string;
  ok: boolean;
  message: string;
  serverRevision?: number;
}

const textAnswer = (answers: Record<string, unknown>, id: string) => {
  const value = answers[id];
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

function deviceId() {
  const key = "ukihdp-device-id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.localStorage.setItem(key, created);
  return created;
}

export async function syncSurveyDraft(draft: OfflineSurveyDraft): Promise<SyncResult> {
  const fail = async (message: string) => {
    await updateSurveyDraftStatus(draft.id, draft.status, draft.serverRevision, draft.reviewNote, "sync_failed", message).catch(() => undefined);
    return { draftId: draft.id, ok: false, message } satisfies SyncResult;
  };
  if (!isSupabaseConfigured) return fail("Supabase is not configured; the draft remains safely queued on this device.");
  if (!navigator.onLine) return fail("No internet connection; synchronization will be retried later.");
  await updateSurveyDraftStatus(draft.id, draft.status, draft.serverRevision, draft.reviewNote, "syncing", "Uploading to the central database…").catch(() => undefined);
  const client = getSupabaseBrowserClient();
  if (!client) return fail("The central database client is unavailable.");
  const { data: authData } = await client.auth.getUser();
  const user = authData.user;
  if (!user) return fail("Sign in before synchronizing queued surveys.");

  const { data: version, error: versionError } = await client.from("questionnaire_versions").select("id").eq("code", draft.questionnaireId).eq("version", draft.questionnaireVersion).maybeSingle();
  if (versionError || !version) return fail("The matching questionnaire version is not published in Supabase.");

  const { data: existing, error: lookupError } = await client.from("survey_submissions").select("id, revision, status").eq("client_generated_id", draft.id).maybeSingle();
  if (lookupError) return fail(lookupError.message);
  if (existing && draft.serverRevision !== undefined && existing.revision !== draft.serverRevision) {
    await client.from("sync_events").insert({ submission_id: existing.id, device_id: deviceId(), client_revision: draft.serverRevision, server_revision: existing.revision, result: "conflict", detail: { localUpdatedAt: draft.updatedAt } });
    return fail("A newer server version exists. The local record was not overwritten.");
  }

  const answers = (draft.sectionData.answers ?? {}) as Record<string, unknown>;
  const nextRevision = existing ? Number(existing.revision) + 1 : 1;
  const submission = {
    client_generated_id: draft.id,
    questionnaire_version_id: version.id,
    enumerator_id: user.id,
    status: "submitted",
    study_group: textAnswer(answers, "1.4")?.toLowerCase() ?? null,
    district: textAnswer(answers, "1.5"),
    block: textAnswer(answers, "1.6"),
    fpo_cluster: textAnswer(answers, "1.7") ?? textAnswer(answers, "11.1"),
    village: textAnswer(answers, "1.8"),
    latitude: Number((answers["1.11"] as Record<string, unknown> | undefined)?.latitude) || null,
    longitude: Number((answers["1.11"] as Record<string, unknown> | undefined)?.longitude) || null,
    gps_accuracy_meters: Number((answers["1.11"] as Record<string, unknown> | undefined)?.accuracy) || null,
    started_at: typeof answers.QC1 === "string" ? answers.QC1 : null,
    submitted_at: new Date().toISOString(),
    revision: nextRevision,
    updated_at: new Date().toISOString(),
    ...(draft.studyId ? { study_id: draft.studyId } : {}),
  };

  const savePayload = (submissionId: string) => client.from("survey_submission_payloads").upsert({
    submission_id: submissionId,
    questionnaire_code: draft.questionnaireId,
    questionnaire_version: draft.questionnaireVersion,
    answers,
    source_device_id: deviceId(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "submission_id" });

  // A returned record's payload must be updated while its server status is still
  // "returned". RLS intentionally blocks enumerator edits after resubmission.
  if (existing) {
    const { error: payloadError } = await savePayload(existing.id);
    if (payloadError) return fail(payloadError.message);
  }

  const query = existing
    ? client.from("survey_submissions").update(submission).eq("id", existing.id).select("id, revision").single()
    : client.from("survey_submissions").insert(submission).select("id, revision").single();
  const { data: saved, error: submissionError } = await query;
  if (submissionError || !saved) return fail(submissionError?.message ?? "Could not create the central submission.");

  if (!existing) {
    const { error: payloadError } = await savePayload(saved.id);
    if (payloadError) return fail(payloadError.message);
  }

  await client.from("sync_events").insert({ submission_id: saved.id, device_id: deviceId(), client_revision: nextRevision, server_revision: saved.revision, result: "accepted", detail: { questionnaireCode: draft.questionnaireId } });
  await updateSurveyDraftStatus(draft.id, "submitted", saved.revision, undefined, "synced", "Confirmed by the central database.");
  return { draftId: draft.id, ok: true, message: "Survey synchronized and submitted for review.", serverRevision: saved.revision };
}

export async function syncSurveyDraftById(id: string) {
  const draft = await getSurveyDraft(id);
  if (!draft) return { draftId: id, ok: false, message: "The local draft could not be found." } satisfies SyncResult;
  return syncSurveyDraft(draft);
}

export async function syncAllQueuedSurveys() {
  const drafts = await listSurveyDrafts();
  const pending = drafts.filter((draft) => draft.status === "queued" || draft.status === "returned");
  const results: SyncResult[] = [];
  for (const draft of pending) results.push(await syncSurveyDraft(draft));
  return results;
}

export async function refreshLocalDraftStatuses() {
  if (!isSupabaseConfigured || !navigator.onLine) return [];
  const client = getSupabaseBrowserClient();
  if (!client) return [];
  const drafts = await listSurveyDrafts();
  if (!drafts.length) return [];

  const { data, error } = await client
    .from("survey_submissions")
    .select("client_generated_id, status, revision, review_note")
    .in("client_generated_id", drafts.map((draft) => draft.id));
  if (error) return [];

  for (const remote of data ?? []) {
    const local = drafts.find((draft) => draft.id === remote.client_generated_id);
    if (local && (local.status !== remote.status || local.serverRevision !== remote.revision)) {
      await updateSurveyDraftStatus(local.id, remote.status, remote.revision, remote.review_note ?? undefined);
    }
  }
  return data ?? [];
}
