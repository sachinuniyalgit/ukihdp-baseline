"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { refreshLocalDraftStatuses, syncAllQueuedSurveys } from "@/lib/survey-sync";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export function SyncOnReconnect() {
  const { user } = useAuth();

  useEffect(() => {
    if (!isSupabaseConfigured || !user) return;
    const synchronize = async () => {
      if (!navigator.onLine) return;
      await refreshLocalDraftStatuses();
      await syncAllQueuedSurveys();
    };
    window.addEventListener("online", synchronize);
    void synchronize();
    return () => window.removeEventListener("online", synchronize);
  }, [user]);

  return null;
}
