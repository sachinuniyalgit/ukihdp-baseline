"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AccessGate } from "@/components/auth/access-gate";
import { useAuth } from "@/components/auth/auth-provider";
import { deleteSurveyDraft, listSurveyDrafts, type OfflineSurveyDraft } from "@/lib/offline-drafts";
import { refreshLocalDraftStatuses, syncAllQueuedSurveys, syncSurveyDraft } from "@/lib/survey-sync";

export function DraftsWorkspace() {
  return <AccessGate roles={["enumerator", "reviewer", "admin"]}><DraftsContent /></AccessGate>;
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
    if (!window.confirm(`Delete local ${draft.status} record ${draft.id}?`)) return;
    await deleteSurveyDraft(draft.id);
    await refresh();
  };

  return <main className="operations-page">
    <header className="operations-top"><div><Link href="/">&larr; Dashboard</Link><span>Enumerator workspace</span></div><b>{auth.demoMode ? "Local preview" : auth.profile?.displayName ?? "Authenticated"}</b></header>
    <section className="operations-heading"><div><p>Offline field records</p><h1>My drafts and sync queue</h1><span>Records remain on this device until they are securely accepted by the central database.</span></div><div><Link href="/survey/new">+ New survey</Link><button onClick={syncAll}>Synchronize all</button></div></section>
    {auth.demoMode && <div className="operations-banner"><strong>Database connection pending</strong><span>Local drafts work now. Central synchronization activates when Supabase credentials are added.</span></div>}
    {message && <div className="operations-message">{message}</div>}
    <section className="operations-panel">
      <header><strong>{drafts.length} local record(s)</strong><span>Draft / Queued / Submitted / Returned</span></header>
      {loading ? <div className="operations-empty">Loading this device&apos;s drafts...</div> : drafts.length ? <div className="draft-list">{drafts.map((draft) => <article key={draft.id}>
        <div><span className={`status ${draft.status}`}>{draft.status.replaceAll("_", " ")}</span><h2>{draft.id}</h2><p>{draft.questionnaireId} &middot; {draft.questionnaireVersion}</p></div>
        <div><time>{new Date(draft.updatedAt).toLocaleString()}</time><small>{draft.serverRevision ? `Server revision ${draft.serverRevision}` : "Not yet accepted by server"}</small></div>
        <nav>
          {["draft", "returned"].includes(draft.status) && <Link href={`/survey/new?draft=${encodeURIComponent(draft.id)}`}>Open &amp; edit</Link>}
          {["queued", "returned"].includes(draft.status) && <button onClick={() => syncOne(draft)}>Sync now</button>}
          <button className="delete" onClick={() => remove(draft)}>Delete local copy</button>
        </nav>
      </article>)}</div> : <div className="operations-empty"><strong>No local survey drafts yet.</strong><p>Start a household or FPO questionnaire; it will save automatically on this device.</p><Link href="/survey/new">Start questionnaire</Link></div>}
    </section>
  </main>;
}
