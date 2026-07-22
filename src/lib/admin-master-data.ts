import { INITIAL_FOCUS_CROPS, type CropMasterRecord, type CropVarietyRecord } from "@/config/crop-master";
import { projectFpos } from "@/config/project-master";

export interface ConfirmationSetting<T> {
  status: "Confirmed" | "Pending Confirmation";
  value: T;
}

export interface FpoFocusMapping {
  fpoName: string;
  cropNames: string[];
  status: "Confirmed" | "Pending Confirmation";
}

export interface MasterDataAuditRecord {
  id: string;
  area: string;
  previousValue: unknown;
  newValue: unknown;
  changedBy: string;
  changedAt: string;
}

export interface AdminMasterData {
  youthAgeDefinition: ConfirmationSetting<{ minimumAge: number | null; maximumAge: number | null }>;
  landUnitConversion: ConfirmationSetting<{ naliToAcre: number | null; naliToHectare: number | null }>;
  crops: CropMasterRecord[];
  varieties: CropVarietyRecord[];
  fpoFocusMappings: FpoFocusMapping[];
  auditTrail: MasterDataAuditRecord[];
}

export const DEFAULT_ADMIN_MASTER_DATA: AdminMasterData = {
  youthAgeDefinition: { status: "Pending Confirmation", value: { minimumAge: null, maximumAge: null } },
  landUnitConversion: { status: "Pending Confirmation", value: { naliToAcre: null, naliToHectare: null } },
  crops: INITIAL_FOCUS_CROPS,
  varieties: [],
  fpoFocusMappings: projectFpos.map((item) => ({ fpoName: item.name, cropNames: item.focusCrops, status: "Confirmed" })),
  auditTrail: [],
};

const STORAGE_KEY = "ukihdp-admin-master-data-v1";
const CHANGE_EVENT = "ukihdp-master-data-change";
let cachedSnapshot: AdminMasterData | undefined;

export function getAdminMasterData(): AdminMasterData {
  if (typeof window === "undefined") return DEFAULT_ADMIN_MASTER_DATA;
  if (cachedSnapshot) return cachedSnapshot;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    cachedSnapshot = DEFAULT_ADMIN_MASTER_DATA;
    return cachedSnapshot;
  }
  try {
    cachedSnapshot = JSON.parse(stored) as AdminMasterData;
  } catch {
    cachedSnapshot = DEFAULT_ADMIN_MASTER_DATA;
  }
  return cachedSnapshot;
}

export function subscribeToAdminMasterData(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const listener = () => callback();
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export function saveAdminMasterData(
  next: Omit<AdminMasterData, "auditTrail">,
  audit: { area: string; previousValue: unknown; newValue: unknown; changedBy?: string },
) {
  const previous = getAdminMasterData();
  const record: MasterDataAuditRecord = {
    id: crypto.randomUUID(),
    area: audit.area,
    previousValue: audit.previousValue,
    newValue: audit.newValue,
    changedBy: audit.changedBy ?? "Authorized Admin",
    changedAt: new Date().toISOString(),
  };
  cachedSnapshot = { ...next, auditTrail: [record, ...previous.auditTrail].slice(0, 250) };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedSnapshot));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function resetAdminMasterData() {
  cachedSnapshot = DEFAULT_ADMIN_MASTER_DATA;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedSnapshot));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
