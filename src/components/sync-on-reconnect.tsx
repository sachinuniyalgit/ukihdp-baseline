"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { refreshLocalDraftStatuses, syncAllQueuedSurveys } from "@/lib/survey-sync";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { refreshAssignedStudyCache } from "@/lib/studies/study-sync";

export function SyncOnReconnect() {
  const { user, testMode } = useAuth();

  useEffect(() => {
    if (!isSupabaseConfigured || !user || testMode) return;
    const synchronize = async () => {
      if (!navigator.onLine) return;
      await refreshAssignedStudyCache();
      await refreshLocalDraftStatuses();
      await syncAllQueuedSurveys();
    };
    window.addEventListener("online", synchronize);
    void synchronize();
    return () => window.removeEventListener("online", synchronize);
  }, [testMode, user]);

  return null;
}
