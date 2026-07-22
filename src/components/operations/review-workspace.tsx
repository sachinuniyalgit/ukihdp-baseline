"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AccessGate } from "@/components/auth/access-gate";
import { useAuth } from "@/components/auth/auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface ReviewSubmission {
  id: string;
  client_generated_id: string;
  status: "submitted" | "under_review" | "returned" | "approved";
  district: string | null;
  block: string | null;
  fpo_cluster: string | null;
  village: string | null;
  study_group: string | null;
  submitted_at: string | null;
  revision: number;
  enumerator_id: string;
}

export function ReviewWorkspace() {
  return <AccessGate roles={["reviewer", "admin"]}><ReviewContent /></AccessGate>;
}

function ReviewContent() {
  const auth = useAuth();
  const [items, setItems] = useState<ReviewSubmission[]>([]);
  const [loading, setLoading] = useState(auth.configured);
  const [message, setMessage] = useState("");
  const [comments, setComments] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    if (!client || !auth.user) return;
    setLoading(true);
    const { data, error } = await client
      .from("survey_submissions")
      .select("id, client_generated_id, status, district, block, fpo_cluster, village, study_group, submitted_at, revision, enumerator_id")
      .in("status", ["submitted", "under_review", "returned", "approved"])
      .order("submitted_at", { ascending: false })
      .limit(100);
    setLoading(false);
    if (error) return setMessage(error.message);
    setItems((data ?? []) as ReviewSubmission[]);
  }, [auth.user]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const transition = async (item: ReviewSubmission, toStatus: ReviewSubmission["status"]) => {
    const client = getSupabaseBrowserClient();
    if (!client || !auth.user) return;
    const comment = comments[item.id]?.trim() ?? "";
    if (toStatus === "returned" && !comment) return setMessage("Enter a correction note before returning a survey.");
    setMessage("Saving review decision...");
    const update: Record<string, unknown> = {
      status: toStatus,
      reviewer_id: auth.user.id,
      review_note: toStatus === "returned" ? comment : null,
      updated_at: new Date().toISOString(),
    };
    if (toStatus === "approved") update.approved_at = new Date().toISOString();
    const { error } = await client.from("survey_submissions").update(update).eq("id", item.id);
    if (error) return setMessage(error.message);
    const { error: eventError } = await client.from("review_events").insert({
      submission_id: item.id,
      reviewer_id: auth.user.id,
      from_status: item.status,
      to_status: toStatus,
      comment: comment || null,
    });
    if (eventError) return setMessage(`Status changed, but the review event could not be recorded: ${eventError.message}`);
    setMessage(toStatus === "approved" ? "Survey approved as verified data." : toStatus === "returned" ? "Survey returned to the enumerator for correction." : "Review started.");
    await refresh();
  };

  return <main className="operations-page">
    <header className="operations-top"><div><Link href="/">&larr; Dashboard</Link><span>Reviewer workspace</span></div><b>{auth.profile?.displayName ?? "Reviewer"}</b></header>
    <section className="operations-heading"><div><p>Data quality workflow</p><h1>Review queue</h1><span>Inspect submitted records, return corrections with a reason, or approve verified survey data.</span></div><div><button onClick={refresh}>Refresh queue</button></div></section>
    {auth.demoMode ? <div className="operations-banner"><strong>Supabase connection required</strong><span>The live review queue activates after database credentials and migrations are configured.</span></div> : message && <div className="operations-message">{message}</div>}
    <section className="operations-panel">
      <header><strong>{items.length} central submission(s)</strong><span>Maximum 100 most recent records</span></header>
      {loading ? <div className="operations-empty">Loading protected submissions...</div> : items.length ? <div className="review-list">{items.map((item) => <article key={item.id}>
        <header><div><span className={`status ${item.status}`}>{item.status.replaceAll("_", " ")}</span><h2>{item.client_generated_id}</h2><p>{[item.village, item.block, item.district].filter(Boolean).join(" · ") || "Location not recorded"}</p></div><div><strong>{item.fpo_cluster ?? "No FPO recorded"}</strong><small>{item.study_group ?? "No study group"} · Revision {item.revision}</small><time>{item.submitted_at ? new Date(item.submitted_at).toLocaleString() : "Not timestamped"}</time></div></header>
        <textarea placeholder="Reviewer observations or required corrections" value={comments[item.id] ?? ""} onChange={(event) => setComments((current) => ({ ...current, [item.id]: event.target.value }))} />
        <footer>{item.status === "submitted" && <button onClick={() => transition(item, "under_review")}>Start review</button>}{["submitted", "under_review"].includes(item.status) && <button className="return" onClick={() => transition(item, "returned")}>Return for correction</button>}{["submitted", "under_review"].includes(item.status) && <button className="approve" onClick={() => transition(item, "approved")}>Approve verified record</button>}</footer>
      </article>)}</div> : <div className="operations-empty"><strong>No submissions in the review queue.</strong><p>Submitted surveys will appear here after secure synchronization.</p></div>}
    </section>
  </main>;
}
