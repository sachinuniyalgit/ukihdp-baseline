"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AccessGate } from "@/components/auth/access-gate";
import { useAuth } from "@/components/auth/auth-provider";
import { loadOperationalRecords, type OperationalRecord } from "@/lib/insights/operational-data";
import { summarizeStudy } from "@/lib/insights/summaries";
import { listStudies } from "@/lib/studies/study-catalog";
import type { StudyDefinition } from "@/lib/studies/types";

export function AnalyticsWorkspace() {
  const auth = useAuth();
  const [studies, setStudies] = useState<StudyDefinition[]>([]);
  const [records, setRecords] = useState<OperationalRecord[]>([]);
  const [studyId, setStudyId] = useState("");
  const [warning, setWarning] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([listStudies(), loadOperationalRecords({ testMode: auth.testMode, userId: auth.user?.id })])
      .then(([nextStudies, result]) => {
        if (cancelled) return;
        const active = nextStudies.filter((study) => study.status !== "archived");
        setStudies(active);
        setRecords(result.records);
        setWarning(result.warning);
        const requested = new URLSearchParams(window.location.search).get("study") ?? "";
        setStudyId((current) => current || (active.some((study) => study.id === requested) ? requested : active[0]?.id) || "");
        setLoading(false);
      }).catch((error) => {
        if (!cancelled) {
          setWarning(error instanceof Error ? error.message : "Analytics could not be loaded.");
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [auth.testMode, auth.user?.id]);

  const study = studies.find((item) => item.id === studyId);
  const filtered = useMemo(() => records.filter((record) => !studyId || record.studyId === studyId), [records, studyId]);
  const summary = useMemo(() => summarizeStudy(filtered, study), [filtered, study]);
  const totalStatus = summary.statuses.reduce((sum, item) => sum + item.value, 0);
  const maxDistrict = Math.max(1, ...summary.districts.map((district) => district.total));
  const maxCrop = Math.max(1, ...summary.focusCrops.map((crop) => crop.households));

  return <AccessGate roles={["admin", "researcher", "supervisor", "reviewer"]}>
    <main className="insights-page">
      <header className="insights-topbar"><div><Link href="/">FieldFlow</Link><span>Results &amp; Analytics</span></div><b>Verified operational data</b></header>
      <section className="insights-heading">
        <div><p>Study intelligence</p><h1>Results &amp; Analytics</h1><span>Live analysis from field submissions, verification status, and approved questionnaire data.</span></div>
        <label><span>Study</span><select value={studyId} onChange={(event) => setStudyId(event.target.value)}>{studies.map((item) => <option key={item.id} value={item.id}>{item.shortName}</option>)}</select></label>
      </section>
      {warning && <p className="insights-warning">Some central data could not be loaded: {warning}. Device records remain visible.</p>}
      {loading ? <section className="insights-empty"><strong>Preparing study analytics…</strong></section> : <>
        <section className="insight-kpis">
          <Kpi label="Collection progress" value={`${summary.completion}%`} note={`${summary.approved} approved of ${summary.target || "—"} target`} tone="blue" />
          <Kpi label="Treatment approved" value={summary.treatment} note={`Target ${study?.treatmentTarget ?? "—"}`} tone="green" />
          <Kpi label="Control approved" value={summary.control} note={`Target ${study?.controlTarget ?? "—"}`} tone="purple" />
          <Kpi label="Quality attention" value={summary.returned + summary.missingGps + summary.poorGps} note="Returned or GPS quality flags" tone="amber" />
        </section>
        <section className="analytics-grid">
          <article className="insight-card"><CardTitle eyebrow="Workflow" title="Survey status distribution" /><div className="status-visual"><div className="analytics-donut" style={{ background: donutGradient(summary.statuses, totalStatus) }}><span><b>{summary.total}</b><small>records</small></span></div><div className="analytics-legend">{summary.statuses.map((item) => <div key={item.name}><i style={{ background: item.color }} /><span>{item.name}</span><b>{item.value}</b></div>)}</div></div></article>
          <article className="insight-card"><CardTitle eyebrow="Sample design" title="Treatment and control coverage" /><BarRow name="Treatment" value={summary.treatment} target={study?.treatmentTarget ?? 0} color="#3da76a" /><BarRow name="Control" value={summary.control} target={study?.controlTarget ?? 0} color="#7357ad" /><BarRow name="Overall" value={summary.approved} target={summary.target} color="#2c7ec4" /></article>
          <article className="insight-card"><CardTitle eyebrow="Geography" title="District collection progress" /><div className="horizontal-bars">{summary.districts.length ? summary.districts.map((district) => <div key={district.name}><header><span>{district.name}</span><b>{district.approved} approved · {district.total} total</b></header><div><i style={{ width: `${district.total / maxDistrict * 100}%` }} /></div></div>) : <Empty text="District data will appear after survey identification is saved." />}</div></article>
          <article className="insight-card indicator-card"><CardTitle eyebrow="Approved records" title="Baseline indicator snapshot" /><div className="indicator-grid"><Indicator label="Average annual household income" value={summary.avgIncome ? `₹${summary.avgIncome.toLocaleString("en-IN")}` : "—"} /><Indicator label="Average household size" value={summary.avgHouseholdSize || "—"} /><Indicator label="Average dietary groups" value={summary.avgDietaryGroups || "—"} /><Indicator label="FPO member households" value={summary.fpoMembers} /></div><p>Indicators use approved records only. A dash means no verified answer is yet available.</p></article>
          <article className="insight-card"><CardTitle eyebrow="Horticulture" title="Focus crops recorded" /><div className="crop-bars">{summary.focusCrops.length ? summary.focusCrops.slice(0, 12).map((crop) => <div key={crop.name}><span>{crop.name}</span><div><i style={{ width: `${crop.households / maxCrop * 100}%` }} /></div><b>{crop.households}</b></div>) : <Empty text="Approved focus-crop data will appear here." />}</div></article>
          <article className="insight-card"><CardTitle eyebrow="Data quality" title="Records requiring attention" /><div className="quality-list"><Quality label="Returned for correction" value={summary.returned} tone="red" /><Quality label="GPS not captured" value={summary.missingGps} tone="amber" /><Quality label="GPS accuracy over 50 m" value={summary.poorGps} tone="amber" /><Quality label="Waiting for review" value={summary.submitted + summary.underReview} tone="purple" /></div><Link className="card-link" href="/review">Open review workflow →</Link></article>
        </section>
      </>}
    </main>
  </AccessGate>;
}

function Kpi({ label, value, note, tone }: { label: string; value: string | number; note: string; tone: string }) { return <article className={`insight-kpi ${tone}`}><span>{label}</span><strong>{value}</strong><p>{note}</p></article>; }
function CardTitle({ eyebrow, title }: { eyebrow: string; title: string }) { return <header className="insight-card-title"><span>{eyebrow}</span><h2>{title}</h2></header>; }
function Indicator({ label, value }: { label: string; value: string | number }) { return <div><span>{label}</span><b>{value}</b></div>; }
function Quality({ label, value, tone }: { label: string; value: number; tone: string }) { return <div><i className={tone} /><span>{label}</span><b>{value}</b></div>; }
function Empty({ text }: { text: string }) { return <div className="chart-empty">{text}</div>; }
function BarRow({ name, value, target, color }: { name: string; value: number; target: number; color: string }) { const progress = target ? Math.min(100, value / target * 100) : 0; return <div className="target-bar"><header><span>{name}</span><b>{value} / {target || "—"}</b></header><div><i style={{ width: `${progress}%`, background: color }} /></div><small>{target ? `${progress.toFixed(1)}% of target` : "Target not configured"}</small></div>; }
function donutGradient(items: Array<{ value: number; color: string }>, total: number) { if (!total) return "conic-gradient(#dfe7e9 0 100%)"; let cursor = 0; return `conic-gradient(${items.map((item) => { const start = cursor; cursor += item.value / total * 100; return `${item.color} ${start}% ${cursor}%`; }).join(",")})`; }
