"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AccessGate } from "@/components/auth/access-gate";
import { useAuth } from "@/components/auth/auth-provider";
import { deleteSurveyDraft, listSurveyDrafts, type OfflineSurveyDraft } from "@/lib/offline-drafts";
import { refreshLocalDraftStatuses, syncAllQueuedSurveys, syncSurveyDraft } from "@/lib/survey-sync";

export function DraftsWorkspace() {
  return <AccessGate roles={["enumerator", "supervisor", "reviewer", "researcher", "admin"]}><DraftsContent /></AccessGate>;
}

function DraftsContent() {
  const auth = useAuth();
  const [drafts, setDrafts] = useState<OfflineSurveyDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const refresh = () => listSurveyDrafts().then((items) => { setDrafts(items); setLoading(false); });

  useEffect(() => {
    void refreshLocalDraftStatuses().finally(refresh);
  }, []);

  const syncOne = async (draft: OfflineSurveyDraft) => {
    setMessage("Synchronizing...");
    const result = await syncSurveyDraft(draft);
    setMessage(result.message);
    await refresh();
  };

  const syncAll = async () => {
    setMessage("Synchronizing queued records...");
    const results = await syncAllQueuedSurveys();
    setMessage(results.length ? `${results.filter((item) => item.ok).length} of ${results.length} queued record(s) synchronized.` : "No queued records are waiting.");
    await refresh();
  };

  const remove = async (draft: OfflineSurveyDraft) => {
    if (["queued", "returned"].includes(draft.status) || draft.syncState === "sync_failed" || draft.syncState === "pending_sync" || draft.syncState === "syncing") return setMessage("This local copy cannot be deleted until central synchronization is confirmed.");
    if (!window.confirm(`Delete local ${draft.status} record ${draft.id}?`)) return;
    await deleteSurveyDraft(draft.id);
    await refresh();
  };

  return <main className="operations-page">
    <header className="operations-top"><div><Link href="/">&larr; Dashboard</Link><span>Enumerator workspace</span></div><b>{auth.demoMode ? "Local preview" : auth.profile?.displayName ?? "Authenticated"}</b></header>
    <section className="operations-heading"><div><p>Offline field records</p><h1>My drafts and sync queue</h1><span>Records remain on this device until they are securely accepted by the central database.</span></div><div><Link href="/studies">+ New survey</Link><button onClick={syncAll}>Synchronize all</button></div></section>
    {(auth.demoMode || auth.testMode) && <div className="operations-banner"><strong>Local device testing</strong><span>Offline drafts work now. Use a real approved account for central synchronization and review.</span></div>}
    {message && <div className="operations-message">{message}</div>}
    <section className="operations-panel">
      <header><strong>{drafts.length} local record(s)</strong><span>Draft / Queued / Submitted / Returned</span></header>
      {loading ? <div className="operations-empty">Loading this device&apos;s drafts...</div> : drafts.length ? <div className="draft-list">{drafts.map((draft) => <article key={draft.id}>
        <div><span className={`status ${draft.status}`}>{draft.status.replaceAll("_", " ")}</span><h2>{draft.id}</h2><p>{draft.studyName ?? draft.studyCode ?? "Baseline study"} &middot; {draft.questionnaireVersion}</p></div>
        <div><time>{new Date(draft.updatedAt).toLocaleString()}</time><small>{syncLabel(draft)}</small>{draft.syncMessage && <small>{draft.syncMessage}</small>}</div>
        <nav>
          {["draft", "returned"].includes(draft.status) && <Link href={`/survey/new?${draft.studyId ? `study=${encodeURIComponent(draft.studyId)}&` : ""}draft=${encodeURIComponent(draft.id)}`}>Open &amp; edit</Link>}
          {["queued", "returned"].includes(draft.status) && <button onClick={() => syncOne(draft)}>Sync now</button>}
          {!(["queued", "returned"].includes(draft.status) || ["sync_failed", "pending_sync", "syncing"].includes(draft.syncState ?? "")) && <button className="delete" onClick={() => remove(draft)}>Delete local copy</button>}
        </nav>
      </article>)}</div> : <div className="operations-empty"><strong>No local survey drafts yet.</strong><p>Choose an assigned study and start its published questionnaire; it will save automatically on this device.</p><Link href="/studies">Choose a study</Link></div>}
    </section>
  </main>;
}

function syncLabel(draft: OfflineSurveyDraft) {
  if (draft.syncState === "syncing") return "SYNCING";
  if (draft.syncState === "sync_failed") return "SYNC FAILED · local copy retained";
  if (draft.syncState === "pending_sync" || draft.status === "queued") return "PENDING SYNC";
  if (draft.syncState === "synced" || draft.serverRevision) return `SYNCED${draft.serverRevision ? ` · server revision ${draft.serverRevision}` : ""}`;
  return "SAVED LOCALLY";
}
