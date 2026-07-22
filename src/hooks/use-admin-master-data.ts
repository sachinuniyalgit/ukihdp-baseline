"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_ADMIN_MASTER_DATA, getAdminMasterData, subscribeToAdminMasterData } from "@/lib/admin-master-data";

export function useAdminMasterData() {
  return useSyncExternalStore(subscribeToAdminMasterData, getAdminMasterData, () => DEFAULT_ADMIN_MASTER_DATA);
}
