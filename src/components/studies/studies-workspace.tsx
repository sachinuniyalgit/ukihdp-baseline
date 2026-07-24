"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { AccessGate } from "@/components/auth/access-gate";
import { archiveStudy, listStudies } from "@/lib/studies/study-catalog";
import { listCachedAssignments } from "@/lib/studies/assignment-cache";
import { BASELINE_STUDY_ID } from "@/config/studies";
import type { StudyDefinition } from "@/lib/studies/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface StudyCounts { completed: number; approved: number; underReview: number }

export function StudiesWorkspace() {
  return <AccessGate><StudiesContent /></AccessGate>;
}

function StudiesContent() {
  const auth = useAuth();
  const [studies, setStudies] = useState<StudyDefinition[]>([]);
  const [counts, setCounts] = useState<Record<string, StudyCounts>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const allItems = await listStudies();
    let items = allItems;
    if (auth.profile?.role !== "admin") {
      const assignments = auth.testMode ? [{ studyId: BASELINE_STUDY_ID }] : await listCachedAssignments(auth.user?.id ?? "").catch(() => []);
      const assignedIds = new Set(assignments.map((assignment) => assignment.studyId));
      items = allItems.filter((study) => assignedIds.has(study.id));
    }
    setStudies(items);
    const client = getSupabaseBrowserClient();
    if (client && auth.user && !auth.testMode) {
      const withStudy = await client.from("survey_submissions").select("study_id, status");
      const fallback = withStudy.error ? await client.from("survey_submissions").select("status") : null;
      const records = withStudy.error ? (fallback?.data ?? []).map((item) => ({ ...item, study_id: items[0]?.id })) : (withStudy.data ?? []);
      const next: Record<string, StudyCounts> = {};
      records.forEach((record) => {
        const id = String(record.study_id ?? items[0]?.id ?? "");
        next[id] ??= { completed: 0, approved: 0, underReview: 0 };
        next[id].completed += 1;
        if (record.status === "approved") next[id].approved += 1;
        if (record.status === "submitted" || record.status === "under_review") next[id].underReview += 1;
      });
      setCounts(next);
    }
    setLoading(false);
  }, [auth.profile?.role, auth.testMode, auth.user]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const active = studies.filter((study) => study.status === "active").length;
  const canManage = auth.profile?.role === "admin" || auth.profile?.role === "researcher";

  const archive = async (study: StudyDefinition) => {
    if (!window.confirm(`Archive ${study.shortName}? Historical survey records will remain available.`)) return;
    try { await archiveStudy(study.id); setMessage(`${study.shortName} was archived.`); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Study could not be archived."); }
  };

  return <main className="platform-page">
    <header className="platform-topbar"><div><Link href="/">← Dashboard</Link><span>FieldFlow · Field Data & Assessment Platform</span></div><b>{auth.profile ? roleName(auth.profile.role) : "Workspace"}</b></header>
    <section className="platform-heading"><div><p>Multi-study workspace</p><h1>Studies</h1><span>Create, assign, collect, monitor, map, analyse, and report each study independently.</span></div>{canManage && <Link className="primary-action" href="/studies/new">＋ Create new study</Link>}</section>
    {message && <div className="platform-message">{message}</div>}
    <section className="study-kpis"><article><span>Total studies</span><b>{studies.length}</b></article><article><span>Active</span><b>{active}</b></article><article><span>Draft / paused</span><b>{studies.filter((study) => study.status === "draft" || study.status === "paused").length}</b></article><article><span>Archived</span><b>{studies.filter((study) => study.status === "archived").length}</b></article></section>
    <section className="study-list-panel">
      <header><div><strong>Study catalogue</strong><span>Enumerators see their assigned active studies; managers see studies they manage.</span></div><button onClick={() => void load()}>Refresh</button></header>
      {loading ? <div className="platform-empty">Loading study catalogue…</div> : <div className="study-table-wrap"><table><thead><tr><th>Study</th><th>Status</th><th>Target</th><th>Completed</th><th>Approved</th><th>Progress</th><th>Study period</th><th>Actions</th></tr></thead><tbody>{studies.map((study) => {
        const metric = counts[study.id] ?? { completed: 0, approved: 0, underReview: 0 };
        const progress = study.targetSample ? Math.min(100, Math.round(metric.completed / study.targetSample * 1000) / 10) : 0;
        return <tr key={study.id}><td><strong>{study.shortName}</strong><small>{study.code}</small><p>{study.fullName}</p></td><td><span className={`study-status ${study.status}`}>{study.status}</span></td><td>{study.targetSample.toLocaleString("en-IN")}</td><td>{metric.completed}</td><td>{metric.approved}</td><td><div className="table-progress"><i style={{ width: `${progress}%` }} /></div><small>{progress}%</small></td><td>{formatPeriod(study)}</td><td><div className="study-actions"><Link href={`/studies/${study.id}`}>Open study</Link>{study.status === "active" && <Link href={`/survey/new?study=${study.id}`}>Start survey</Link>}<Link href={`/gis?study=${study.id}`}>View GIS</Link>{canManage && !study.builtIn && study.status !== "archived" && <button onClick={() => void archive(study)}>Archive</button>}</div></td></tr>;
      })}</tbody></table></div>}
    </section>
  </main>;
}

function formatPeriod(study: StudyDefinition) {
  if (!study.startDate && !study.endDate) return "Not configured";
  return `${study.startDate || "—"} → ${study.endDate || "—"}`;
}

function roleName(role: string) {
  return role === "admin" ? "Administrator" : role === "researcher" ? "Study manager" : role === "supervisor" ? "Supervisor" : role === "reviewer" ? "Reviewer" : "Enumerator";
}
