export type StudyLocationType = "study" | "project" | "concern";

export interface StudyLocation {
  id: string;
  studyId: string;
  locationType: StudyLocationType;
  name: string;
  description: string;
  district: string;
  block: string;
  village: string;
  latitude: number;
  longitude: number;
  updatedAt: string;
}

const DATABASE = "fieldflow-gis";
const STORE = "study-locations";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) {
        const store = database.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("studyId", "studyId");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("GIS location storage could not be opened."));
  });
}

export async function listLocalStudyLocations(): Promise<StudyLocation[]> {
  if (typeof indexedDB === "undefined") return [];
  const database = await openDatabase();
  const request = database.transaction(STORE, "readonly").objectStore(STORE).getAll();
  const values = await new Promise<StudyLocation[]>((resolve, reject) => { request.onsuccess = () => resolve(request.result as StudyLocation[]); request.onerror = () => reject(request.error); });
  database.close();
  return values;
}

export async function saveLocalStudyLocation(location: StudyLocation) {
  const database = await openDatabase();
  const transaction = database.transaction(STORE, "readwrite");
  transaction.objectStore(STORE).put(location);
  await waitForTransaction(transaction);
  database.close();
}

export async function deleteLocalStudyLocation(id: string) {
  const database = await openDatabase();
  const transaction = database.transaction(STORE, "readwrite");
  transaction.objectStore(STORE).delete(id);
  await waitForTransaction(transaction);
  database.close();
}

function waitForTransaction(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error ?? new Error("GIS location could not be saved.")); });
}
