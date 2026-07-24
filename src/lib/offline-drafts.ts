import type { SurveyStatus } from "@/lib/survey/types";

const DATABASE_NAME = "ukihdp-field-data";
const DATABASE_VERSION = 1;
const DRAFT_STORE = "survey-drafts";
export const DRAFTS_UPDATED_EVENT = "fieldflow-drafts-updated";
export type LocalSyncState = "saved_locally" | "pending_sync" | "syncing" | "synced" | "sync_failed";

export interface OfflineSurveyDraft {
  id: string;
  questionnaireId: string;
  questionnaireVersion: string;
  studyId?: string;
  studyCode?: string;
  studyName?: string;
  status: SurveyStatus;
  syncState?: LocalSyncState;
  syncMessage?: string;
  updatedAt: string;
  sectionData: Record<string, Record<string, unknown>>;
  serverRevision?: number;
  reviewNote?: string;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Offline storage is not available in this browser."));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DRAFT_STORE)) {
        const store = database.createObjectStore(DRAFT_STORE, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
        store.createIndex("status", "status");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open offline storage."));
  });
}

function waitForRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Offline storage request failed."));
  });
}

export async function saveSurveyDraft(draft: OfflineSurveyDraft): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(DRAFT_STORE, "readwrite");
  transaction.objectStore(DRAFT_STORE).put(draft);
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save the survey draft."));
  });
  database.close();
  window.dispatchEvent(new CustomEvent(DRAFTS_UPDATED_EVENT));
}

export async function getSurveyDraft(id: string): Promise<OfflineSurveyDraft | undefined> {
  const database = await openDatabase();
  const draft = await waitForRequest(database.transaction(DRAFT_STORE, "readonly").objectStore(DRAFT_STORE).get(id));
  database.close();
  return draft as OfflineSurveyDraft | undefined;
}

export async function listSurveyDrafts(): Promise<OfflineSurveyDraft[]> {
  const database = await openDatabase();
  const drafts = await waitForRequest(database.transaction(DRAFT_STORE, "readonly").objectStore(DRAFT_STORE).getAll());
  database.close();
  return (drafts as OfflineSurveyDraft[]).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function queueSurveyForSync(id: string): Promise<void> {
  const draft = await getSurveyDraft(id);
  if (!draft) throw new Error("Survey draft was not found.");
  await saveSurveyDraft({ ...draft, status: "queued", syncState: "pending_sync", syncMessage: undefined, updatedAt: new Date().toISOString() });
}

export async function updateSurveyDraftStatus(id: string, status: SurveyStatus, serverRevision?: number, reviewNote?: string, syncState?: LocalSyncState, syncMessage?: string): Promise<void> {
  const draft = await getSurveyDraft(id);
  if (!draft) throw new Error("Survey draft was not found.");
  await saveSurveyDraft({ ...draft, status, serverRevision: serverRevision ?? draft.serverRevision, reviewNote: reviewNote ?? draft.reviewNote, syncState: syncState ?? draft.syncState, syncMessage: syncMessage ?? draft.syncMessage, updatedAt: new Date().toISOString() });
}

export async function deleteSurveyDraft(id: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(DRAFT_STORE, "readwrite");
  transaction.objectStore(DRAFT_STORE).delete(id);
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not delete the survey draft."));
  });
  database.close();
  window.dispatchEvent(new CustomEvent(DRAFTS_UPDATED_EVENT));
}
