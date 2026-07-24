import type { StudyAssignment } from "@/lib/studies/types";

const DATABASE_NAME = "fieldflow-assignment-cache";
const DATABASE_VERSION = 1;
const STORE = "assignments";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("Assignment cache is unavailable."));
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        const store = request.result.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("userId", "userId");
        store.createIndex("studyId", "studyId");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Assignment cache could not be opened."));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Assignment cache request failed."));
  });
}

export async function replaceCachedAssignments(userId: string, assignments: StudyAssignment[]) {
  const database = await openDatabase();
  const existing = await requestResult(database.transaction(STORE, "readonly").objectStore(STORE).index("userId").getAllKeys(userId));
  const transaction = database.transaction(STORE, "readwrite");
  const store = transaction.objectStore(STORE);
  existing.forEach((key) => store.delete(key));
  assignments.forEach((assignment) => store.put(assignment));
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Assignments could not be cached."));
  });
  database.close();
}

export async function listCachedAssignments(userId: string): Promise<StudyAssignment[]> {
  if (typeof indexedDB === "undefined") return [];
  const database = await openDatabase();
  const rows = await requestResult(database.transaction(STORE, "readonly").objectStore(STORE).index("userId").getAll(userId));
  database.close();
  return (rows as StudyAssignment[]).filter((assignment) => assignment.active);
}
