"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getStudy } from "@/lib/studies/study-catalog";
import type { StudyDefinition } from "@/lib/studies/types";
import { projectFpos, projectMaster } from "@/config/project-master";

export function StudyCommandCentre({ studyId }: { studyId: string }) {
  const [study, setStudy] = useState<StudyDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  useEffect(() => { const timer = window.setTimeout(() => void getStudy(studyId).then((item) => { setStudy(item ?? null); setMessage(window.sessionStorage.getItem("fieldflow-study-publish-message") ?? ""); window.sessionStorage.removeItem("fieldflow-study-publish-message"); setLoading(false); }), 0); return () => window.clearTimeout(timer); }, [studyId]);
  if (loading) return <main className="platform-page"><div className="platform-empty">Loading study workspace…</div></main>;
  if (!study) return <main className="platform-page"><div className="platform-empty"><strong>Study not found</strong><Link href="/studies">Return to studies</Link></div></main>;
  return <main className="platform-page">
    <header className="platform-topbar"><div><Link href="/studies">← Studies</Link><span>Study workspace</span></div><b>{study.code}</b></header>
    {message && <div className="platform-message">{message}</div>}
    <section className="study-hero"><div><span className={`study-status ${study.status}`}>{study.status}</span><p>{study.organisation}</p><h1>{study.fullName}</h1><div><b>{study.studyType}</b><span>{study.geographicCoverage.join(" · ") || "Geographic coverage pending"}</span></div></div><nav><Link className="primary-action" href={`/survey/new?study=${study.id}`}>＋ Start survey</Link><Link href={`/gis?study=${study.id}`}>Open study GIS</Link></nav></section>
    <section className="study-kpis command"><article><span>Target sample</span><b>{study.targetSample.toLocaleString("en-IN")}</b></article>{study.treatmentTarget !== undefined && <article><span>Treatment target</span><b>{study.treatmentTarget}</b></article>}{study.controlTarget !== undefined && <article><span>Control target</span><b>{study.controlTarget}</b></article>}<article><span>Questionnaire</span><b>{study.questionnaireVersion}</b></article><article><span>{study.builtIn ? "Districts" : "Coverage areas"}</span><b>{study.geographicCoverage.length}</b></article>{study.builtIn && <article><span>FPO clusters</span><b>{projectFpos.length}</b></article>}</section>
    {study.builtIn && <section className="baseline-study-facts"><article><span>Approved study identifier</span><b>UKIHDP</b></article><article><span>Focus crops</span><p>{projectMaster.focusCrops.join(" · ")}</p></article><article><span>District coverage</span><p>{study.geographicCoverage.join(" · ")}</p></article></section>}
    <section className="command-grid"><article><h2>Study information</h2><dl><dt>Short name</dt><dd>{study.shortName}</dd><dt>Study lead / PI</dt><dd>{study.studyLead || "Not configured"}</dd><dt>Contact person</dt><dd>{study.contactPerson || "Not configured"}</dd><dt>Study period</dt><dd>{study.startDate || "—"} → {study.endDate || "—"}</dd><dt>Questionnaire status</dt><dd>{study.questionnaireStatus}</dd></dl><p>{study.description}</p></article><article><h2>Study operations</h2><div className="command-actions"><Link href={`/survey/new?study=${study.id}`}>Questionnaire & survey</Link><Link href={`/gis?study=${study.id}`}>GIS locations</Link><Link href={`/analytics?study=${study.id}`}>Results & analytics</Link><Link href={`/reports?study=${study.id}`}>Standard reports</Link><Link href="/drafts">Offline drafts & sync</Link><Link href="/review">Review queue</Link>{!study.builtIn && <Link href={`/studies/${study.id}/edit`}>Edit study / questionnaire</Link>}</div></article></section>
  </main>;
}
