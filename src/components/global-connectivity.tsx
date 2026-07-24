"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { DRAFTS_UPDATED_EVENT, listSurveyDrafts } from "@/lib/offline-drafts";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  window.addEventListener(DRAFTS_UPDATED_EVENT, callback);
  return () => { window.removeEventListener("online", callback); window.removeEventListener("offline", callback); window.removeEventListener(DRAFTS_UPDATED_EVENT, callback); };
}

export function GlobalConnectivity() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  const [pending, setPending] = useState(0);
  useEffect(() => {
    let active = true;
    const update = () => void listSurveyDrafts().then((drafts) => { if (active) setPending(drafts.filter((draft) => draft.status === "queued" || draft.syncState === "sync_failed" || draft.syncState === "pending_sync").length); }).catch(() => undefined);
    update();
    const interval = window.setInterval(update, 15000);
    window.addEventListener(DRAFTS_UPDATED_EVENT, update);
    return () => { active = false; window.clearInterval(interval); window.removeEventListener(DRAFTS_UPDATED_EVENT, update); };
  }, []);
  return <div className={`global-connectivity ${online ? "online" : "offline"}`}><i /><span>{online ? "Online" : "Offline"}</span>{pending > 0 && <Link href="/drafts">Pending sync: {pending}</Link>}</div>;
}
