import { baselineStudy, BASELINE_STUDY_ID } from "@/config/studies";
import type { StudyDefinition } from "@/lib/studies/types";

const DATABASE_NAME = "fieldflow-platform";
const DATABASE_VERSION = 1;
const STUDY_STORE = "studies";
export const STUDIES_UPDATED_EVENT = "fieldflow-studies-updated";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Local study storage is unavailable in this browser."));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STUDY_STORE)) {
        const store = database.createObjectStore(STUDY_STORE, { keyPath: "id" });
        store.createIndex("code", "code", { unique: true });
        store.createIndex("status", "status");
        store.createIndex("updatedAt", "updatedAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the FieldFlow study catalogue."));
  });
}

function waitForRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Study catalogue operation failed."));
  });
}

export async function listStudies(): Promise<StudyDefinition[]> {
  if (typeof indexedDB === "undefined") return [baselineStudy];
  const database = await openDatabase();
  const stored = await waitForRequest(database.transaction(STUDY_STORE, "readonly").objectStore(STUDY_STORE).getAll());
  database.close();
  const studies = (stored as StudyDefinition[]).filter((study) => study.id !== BASELINE_STUDY_ID);
  return [baselineStudy, ...studies].sort((a, b) => {
    if (a.builtIn) return -1;
    if (b.builtIn) return 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export async function getStudy(id: string): Promise<StudyDefinition | undefined> {
  if (id === BASELINE_STUDY_ID || id === "ukihdp-baseline") return baselineStudy;
  if (typeof indexedDB === "undefined") return undefined;
  const database = await openDatabase();
  const study = await waitForRequest(database.transaction(STUDY_STORE, "readonly").objectStore(STUDY_STORE).get(id));
  database.close();
  return study as StudyDefinition | undefined;
}

export async function saveStudy(study: StudyDefinition): Promise<void> {
  if (study.builtIn || study.id === BASELINE_STUDY_ID) throw new Error("The built-in baseline study cannot be replaced from the local catalogue.");
  const database = await openDatabase();
  const transaction = database.transaction(STUDY_STORE, "readwrite");
  transaction.objectStore(STUDY_STORE).put({ ...study, updatedAt: new Date().toISOString() });
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save the study."));
  });
  database.close();
  window.dispatchEvent(new CustomEvent(STUDIES_UPDATED_EVENT));
}

export async function archiveStudy(id: string): Promise<void> {
  const study = await getStudy(id);
  if (!study || study.builtIn) throw new Error("The built-in baseline study cannot be archived from local preview.");
  await saveStudy({ ...study, status: "archived" });
}
