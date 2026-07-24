"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { listSurveyDrafts, type OfflineSurveyDraft } from "@/lib/offline-drafts";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AppRole, SurveyStatus } from "@/lib/survey/types";
import { listStudies } from "@/lib/studies/study-catalog";
import type { StudyDefinition } from "@/lib/studies/types";
import { BASELINE_STUDY_ID } from "@/config/studies";

interface DashboardSubmission {
  id: string;
  study_id?: string | null;
  status: SurveyStatus;
  study_group: "treatment" | "control" | null;
  district: string | null;
  village: string | null;
  latitude: number | null;
  longitude: number | null;
  gps_accuracy_meters: number | null;
  enumerator_id: string;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  review_note: string | null;
}

interface DashboardPayload {
  submission_id: string;
  answers: Record<string, unknown>;
}

interface DashboardProfile {
  id: string;
  role: AppRole;
  active: boolean;
}

interface DashboardState {
  submissions: DashboardSubmission[];
  payloads: DashboardPayload[];
  profiles: DashboardProfile[];
  drafts: OfflineSurveyDraft[];
  studies: StudyDefinition[];
  loading: boolean;
  error: string;
}

interface NavigationItem {
  label: string;
  icon: string;
  path?: string;
}

const districts = ["Pithoragarh", "Nainital", "Uttarkashi", "Tehri Garhwal"];

const navigationByRole: Record<AppRole, NavigationItem[]> = {
  admin: [
    { label: "Overview", icon: "⌂", path: "/" },
    { label: "Studies", icon: "▦", path: "/studies" },
    { label: "New Survey", icon: "+", path: "/survey/new" },
    { label: "My Drafts", icon: "▧", path: "/drafts" },
    { label: "Review Queue", icon: "☷", path: "/review" },
    { label: "Field Progress", icon: "↗", path: "/analytics" },
    { label: "GIS Monitoring", icon: "⌖", path: "/gis" },
    { label: "Results & Analytics", icon: "▥", path: "/analytics" },
    { label: "Reports", icon: "□", path: "/reports" },
    { label: "Master Data", icon: "◫", path: "/admin/master-data" },
    { label: "User Management", icon: "♧", path: "/admin/users" },
    { label: "Settings", icon: "⚙", path: "/admin/master-data" },
  ],
  reviewer: [
    { label: "Overview", icon: "⌂", path: "/" },
    { label: "Studies", icon: "▦", path: "/studies" },
    { label: "Review Queue", icon: "☷", path: "/review" },
    { label: "Field Progress", icon: "↗", path: "/analytics" },
    { label: "GIS Monitoring", icon: "⌖", path: "/gis" },
    { label: "Results & Analytics", icon: "▥", path: "/analytics" },
    { label: "Reports", icon: "□", path: "/reports" },
    { label: "My Drafts", icon: "▧", path: "/drafts" },
  ],
  enumerator: [
    { label: "Overview", icon: "⌂", path: "/" },
    { label: "Assigned Studies", icon: "▦", path: "/studies" },
    { label: "New Survey", icon: "+", path: "/survey/new" },
    { label: "My Drafts", icon: "▧", path: "/drafts" },
    { label: "Returned Surveys", icon: "↶", path: "/drafts" },
    { label: "My Progress", icon: "↗", path: "/drafts" },
    { label: "Field Guide", icon: "?", path: "/studies" },
  ],
  researcher: [
    { label: "Overview", icon: "⌂", path: "/" },
    { label: "Studies", icon: "▦", path: "/studies" },
    { label: "New Study", icon: "+", path: "/studies/new" },
    { label: "Field Progress", icon: "↗", path: "/analytics" },
    { label: "GIS Monitoring", icon: "⌖", path: "/gis" },
    { label: "Review Queue", icon: "☷", path: "/review" },
    { label: "Results & Analytics", icon: "▥", path: "/analytics" },
    { label: "Reports", icon: "□", path: "/reports" },
  ],
  supervisor: [
    { label: "Overview", icon: "⌂", path: "/" },
    { label: "Assigned Studies", icon: "▦", path: "/studies" },
    { label: "Field Progress", icon: "↗", path: "/analytics" },
    { label: "GIS Monitoring", icon: "⌖", path: "/gis" },
    { label: "Review Queue", icon: "☷", path: "/review" },
    { label: "Drafts & Sync", icon: "▧", path: "/drafts" },
    { label: "Results & Analytics", icon: "▥", path: "/analytics" },
  ],
};

const moduleDefinitions = [
  { name: "Livelihoods & Income", prefixes: ["1.", "1A.", "2."], color: "#3378c5" },
  { name: "Crop Production", prefixes: ["3.", "3A."], color: "#43a39b" },
  { name: "Inputs & Extension", prefixes: ["4."], color: "#65ba78" },
  { name: "Marketing & Prices", prefixes: ["5.", "6."], color: "#f2b544" },
  { name: "Climate & Risks", prefixes: ["7.", "9."], color: "#ea6260" },
  { name: "Nutrition & Food Security", prefixes: ["8."], color: "#8567b8" },
  { name: "Gender & Youth", prefixes: ["10.", "10A."], color: "#a598cf" },
];

function subscribeToConnectivity(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

const percentage = (value: number, target: number) => target ? Math.min(100, Math.round((value / target) * 1000) / 10) : 0;
const isAnswered = (value: unknown) => value !== null && value !== undefined && value !== "" && (!Array.isArray(value) || value.length > 0);

export function RoleDashboard({ previewRole }: { previewRole?: AppRole } = {}) {
  const router = useRouter();
  const auth = useAuth();
  const online = useSyncExternalStore(subscribeToConnectivity, () => navigator.onLine, () => true);
  const role = previewRole ?? auth.profile?.role ?? "admin";
  const [notice, setNotice] = useState("");
  const [selectedStudyId, setSelectedStudyId] = useState("");
  const [state, setState] = useState<DashboardState>({ submissions: [], payloads: [], profiles: [], drafts: [], studies: [], loading: true, error: "" });

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const client = getSupabaseBrowserClient();
        try {
          const [drafts, studies] = await Promise.all([listSurveyDrafts().catch(() => [] as OfflineSurveyDraft[]), listStudies().catch(() => [] as StudyDefinition[])]);
          if (auth.testMode || !client || !auth.user) {
            if (!cancelled) setState({ submissions: [], payloads: [], profiles: [], drafts, studies, loading: false, error: "" });
            return;
          }

          const submissionResult = await client.from("survey_submissions").select("id, study_id, status, study_group, district, village, latitude, longitude, gps_accuracy_meters, enumerator_id, created_at, updated_at, submitted_at, review_note").order("updated_at", { ascending: false });
          let submissionData = (submissionResult.data ?? []) as DashboardSubmission[];
          let submissionError = submissionResult.error;
          if (submissionError && submissionError.message.includes("study_id")) {
            const fallback = await client.from("survey_submissions").select("id, status, study_group, district, village, latitude, longitude, gps_accuracy_meters, enumerator_id, created_at, updated_at, submitted_at, review_note").order("updated_at", { ascending: false });
            submissionData = (fallback.data ?? []).map((item) => ({ ...item, study_id: BASELINE_STUDY_ID })) as DashboardSubmission[];
            submissionError = fallback.error;
          }
          const [payloadResult, profileResult] = await Promise.all([
            client.from("survey_submission_payloads").select("submission_id, answers"),
            client.from("profiles").select("id, role, active"),
          ]);
          const firstError = submissionError ?? payloadResult.error ?? profileResult.error;
          if (!cancelled) setState({
            submissions: submissionData,
            payloads: (payloadResult.data ?? []) as DashboardPayload[],
            profiles: (profileResult.data ?? []) as DashboardProfile[],
            drafts,
            studies,
            loading: false,
            error: firstError?.message ?? "",
          });
        } catch (error) {
          if (!cancelled) setState((current) => ({ ...current, loading: false, error: error instanceof Error ? error.message : "Dashboard data could not be loaded." }));
        }
      })();
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [auth.user, auth.testMode]);

  const viewState = useMemo(() => {
    if (!selectedStudyId) return state;
    const submissions = state.submissions.filter((item) => (item.study_id ?? BASELINE_STUDY_ID) === selectedStudyId);
    const submissionIds = new Set(submissions.map((item) => item.id));
    return { ...state, submissions, payloads: state.payloads.filter((item) => submissionIds.has(item.submission_id)), drafts: state.drafts.filter((item) => (item.studyId ?? BASELINE_STUDY_ID) === selectedStudyId), studies: state.studies.filter((item) => item.id === selectedStudyId) };
  }, [selectedStudyId, state]);
  const metrics = useMemo(() => summarize(viewState), [viewState]);
  const navigation = navigationByRole[role];
  const title = role === "admin" ? "Overview" : role === "researcher" ? "Study Portfolio" : role === "supervisor" ? "Field Supervision" : role === "reviewer" ? "Review Centre" : "My Fieldwork";
  const subtitle = role === "admin" || role === "researcher" ? "Operational status across assigned FieldFlow studies" : role === "supervisor" ? "Assigned field teams, locations, and pending work" : role === "reviewer" ? "Quality assurance and approval workload" : "Your assigned studies, surveys, drafts, and synchronization status";

  const navigate = (item: NavigationItem) => {
    if (item.path) return router.push(item.path);
    setNotice(`${item.label} is prepared in the dashboard design and will be connected in the next implementation module.`);
  };

  return <main className="dashboard-shell">
    <aside className="dashboard-sidebar">
      <div className="dashboard-brand"><span className="mountain-mark">⌃</span><div><b>Field<span>Flow</span></b><small>Field Data &amp; Assessment Platform</small></div></div>
      <nav>{navigation.map((item) => <button key={item.label} className={item.label === "Overview" ? "active" : ""} onClick={() => navigate(item)}><i>{item.icon}</i>{item.label}</button>)}</nav>
      <div className="dashboard-user"><span>{initials(auth.profile?.displayName ?? "FieldFlow Team")}</span><div><b>{auth.profile?.displayName ?? "FieldFlow Team"}</b><small>{roleLabel(role)}</small></div><button aria-label="Sign out" onClick={() => void auth.signOut()}>⌄</button></div>
    </aside>

    <section className="dashboard-content">
      <header className="dashboard-topbar">
        <div><h1>{title}</h1><p>{subtitle}</p></div>
        <div className="dashboard-actions"><label className="dashboard-study-filter"><span>Study</span><select value={selectedStudyId} onChange={(event) => setSelectedStudyId(event.target.value)}><option value="">All studies</option>{state.studies.filter((study) => study.status !== "archived").map((study) => <option key={study.id} value={study.id}>{study.shortName}</option>)}</select></label><div className="sync-label"><b>{auth.testMode ? "Local test dashboard" : state.error ? "Data connection warning" : state.loading ? "Refreshing dashboard" : "All changes synchronized"}</b><small>{auth.testMode ? "No production data is connected" : state.error || `Last checked ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`}</small></div><span className={`online-pill ${online ? "" : "offline"}`}><i />{auth.testMode ? "Test mode" : online ? "Online" : "Offline"}</span>{["enumerator", "admin", "researcher"].includes(role) ? <button className="new-survey" onClick={() => router.push("/studies")}>＋ New Survey</button> : <button className="new-survey" onClick={() => router.push("/review")}>Open Review Queue</button>}</div>
      </header>

      {notice && <div className="dashboard-notice"><span>{notice}</span><button onClick={() => setNotice("")}>×</button></div>}

      {(role === "admin" || role === "researcher") && <AdminDashboard metrics={metrics} state={viewState} router={router} />}
      {role === "supervisor" && <ReviewerDashboard metrics={metrics} state={viewState} router={router} />}
      {role === "reviewer" && <ReviewerDashboard metrics={metrics} state={viewState} router={router} />}
      {role === "enumerator" && <EnumeratorDashboard metrics={metrics} state={viewState} router={router} />}

      <footer className="dashboard-footer">© 2026 FieldFlow · Field Data &amp; Assessment Platform</footer>
    </section>
  </main>;
}

function AdminDashboard({ metrics, state, router }: DashboardViewProps) {
  return <>
    <section className="summary-cards five">
      <SummaryCard tone="blue" icon="◎" label="Total target" value={metrics.target} note="Across active studies" />
      <SummaryCard tone="green" icon="✓" label="Completed" value={metrics.collected} note={`${percentage(metrics.collected, metrics.target)}% of target`} />
      <SummaryCard tone="amber" icon="◷" label="Pending" value={Math.max(0, metrics.target - metrics.collected)} note={`${percentage(Math.max(0, metrics.target - metrics.collected), metrics.target)}% of target`} />
      <SummaryCard tone="purple" icon="□" label="Under review" value={metrics.underReview} note="Submitted for quality review" />
      <SummaryCard tone="teal" icon="◇" label="Approved" value={metrics.approved} note="Verified survey records" />
    </section>

    <section className="dashboard-grid admin-grid">
      <ProgressPanel metrics={metrics} />
      <StudyPortfolioPanel studies={state.studies} router={router} />
          <DistrictPanel districts={metrics.districts} router={router} />
      <GisAccessPanel submissions={state.submissions} router={router} />
      <OperationsPanel metrics={metrics} profiles={state.profiles} router={router} />
      <AlertsPanel metrics={metrics} router={router} />
    </section>
  </>;
}

function ReviewerDashboard({ metrics, state, router }: DashboardViewProps) {
  const reviewItems = state.submissions.filter((item) => ["submitted", "under_review", "returned"].includes(item.status)).slice(0, 6);
  return <>
    <section className="summary-cards four">
      <SummaryCard tone="amber" icon="☷" label="Awaiting review" value={metrics.submitted} note="Submitted records" />
      <SummaryCard tone="purple" icon="□" label="In review" value={metrics.inReview} note="Currently being checked" />
      <SummaryCard tone="red" icon="↶" label="Returned" value={metrics.returned} note="Correction required" />
      <SummaryCard tone="teal" icon="◇" label="Approved" value={metrics.approved} note="Verified records" />
    </section>
    <section className="dashboard-grid reviewer-grid">
      <article className="dashboard-panel review-worklist"><PanelTitle icon="☷" title="Priority review queue" /><div className="review-worklist-body">{reviewItems.length ? reviewItems.map((item) => <button key={item.id} onClick={() => router.push("/review")}><StatusDot status={item.status} /><div><strong>{item.village || "Village not recorded"}</strong><small>{item.district || "District pending"} · {item.study_group || "Group pending"}</small></div><span>{formatStatus(item.status)} →</span></button>) : <EmptyLine text="No records are waiting for review." />}</div><PanelButton label="Open complete review queue" onClick={() => router.push("/review")} /></article>
          <DistrictPanel districts={metrics.districts} title="District approval progress" router={router} />
      <article className="dashboard-panel quality-panel"><PanelTitle icon="✓" title="Quality controls" /><MetricRows items={[["GPS missing", metrics.missingGps, "red"], ["GPS accuracy over 50 m", metrics.poorGps, "amber"], ["Village missing", metrics.missingVillage, "red"], ["Returned for correction", metrics.returned, "purple"]]} /></article>
      <ModulePanel modules={metrics.modules} collected={metrics.collected} title="Verified analytical coverage" />
      <GisAccessPanel submissions={state.submissions.filter((item) => item.status === "approved")} router={router} title="Approved survey locations" />
    </section>
  </>;
}

function EnumeratorDashboard({ metrics, state, router }: DashboardViewProps) {
  const recentDrafts = state.drafts.slice(0, 5);
  return <>
    <section className="summary-cards five">
      <SummaryCard tone="blue" icon="◎" label="My records" value={metrics.collected} note="Central submissions" />
      <SummaryCard tone="green" icon="✓" label="Submitted" value={metrics.submitted + metrics.inReview} note="Waiting for decision" />
      <SummaryCard tone="teal" icon="◇" label="Approved" value={metrics.approved} note="Verified records" />
      <SummaryCard tone="amber" icon="▧" label="Local drafts" value={metrics.localDrafts} note="On this device" />
      <SummaryCard tone="purple" icon="↻" label="Pending sync" value={metrics.pendingSync} note="Upload when online" />
    </section>
    <section className="dashboard-grid enumerator-grid">
      <article className="dashboard-panel personal-progress"><PanelTitle icon="↗" title="My survey progress" /><div className="large-progress"><div><strong>{metrics.collected}</strong><span>records collected</span><b>{metrics.approved} approved</b></div><ProgressRing value={metrics.collected ? percentage(metrics.approved, metrics.collected) : 0} /></div><div className="mini-stat-row"><span><b>{metrics.treatment}</b>Treatment</span><span><b>{metrics.control}</b>Control</span><span><b>{metrics.returned}</b>Returned</span></div><PanelButton label="Start another household survey" onClick={() => router.push("/survey/new")} /></article>
      <article className="dashboard-panel draft-summary"><PanelTitle icon="▧" title="Recent device records" /><div className="draft-summary-body">{recentDrafts.length ? recentDrafts.map((draft) => <button key={draft.id} onClick={() => router.push(`/survey/new?draft=${encodeURIComponent(draft.id)}`)}><StatusDot status={draft.status} /><div><strong>{draft.id.slice(0, 14)}</strong><small>Updated {new Date(draft.updatedAt).toLocaleDateString("en-IN")}</small></div><span>{formatStatus(draft.status)}</span></button>) : <EmptyLine text="No local drafts on this device." />}</div><PanelButton label="Open drafts and sync queue" onClick={() => router.push("/drafts")} /></article>
      <article className="dashboard-panel checklist-panel"><PanelTitle icon="✓" title="Before field submission" /><ul><li>Confirm informed consent</li><li>Verify District → Block → FPO → Village</li><li>Capture GPS and check accuracy</li><li>Review required answers and household roster</li><li>Save offline before leaving the household</li></ul></article>
      <GisAccessPanel submissions={state.submissions} router={router} title="My survey locations" />
      <article className="dashboard-panel sync-panel"><PanelTitle icon="↻" title="Device synchronization" /><div className={`sync-illustration ${metrics.pendingSync ? "attention" : ""}`}><span>{metrics.pendingSync ? "!" : "✓"}</span><strong>{metrics.pendingSync ? `${metrics.pendingSync} record(s) waiting` : "This device is up to date"}</strong><p>{metrics.pendingSync ? "Connect to the internet and open My Drafts to synchronize safely." : "Submitted records have been accepted by the central database."}</p></div><PanelButton label="Manage device records" onClick={() => router.push("/drafts")} /></article>
    </section>
  </>;
}

interface DashboardMetrics {
  target: number;
  collected: number;
  submitted: number;
  inReview: number;
  underReview: number;
  returned: number;
  approved: number;
  treatment: number;
  control: number;
  localDrafts: number;
  pendingSync: number;
  missingGps: number;
  poorGps: number;
  missingVillage: number;
  districts: Array<{ name: string; collected: number; approved: number }>;
  modules: Array<{ name: string; count: number; color: string }>;
}

function summarize(state: DashboardState): DashboardMetrics {
  const count = (status: SurveyStatus) => state.submissions.filter((item) => item.status === status).length;
  const modules = moduleDefinitions.map((module) => ({
    name: module.name,
    color: module.color,
    count: state.payloads.filter((payload) => Object.entries(payload.answers ?? {}).some(([key, value]) => module.prefixes.some((prefix) => key.startsWith(prefix)) && isAnswered(value))).length,
  }));
  return {
    target: state.studies.filter((study) => study.status === "active").reduce((sum, study) => sum + study.targetSample, 0),
    collected: state.submissions.length,
    submitted: count("submitted"),
    inReview: count("under_review"),
    underReview: count("submitted") + count("under_review"),
    returned: count("returned"),
    approved: count("approved"),
    treatment: state.submissions.filter((item) => item.study_group === "treatment").length,
    control: state.submissions.filter((item) => item.study_group === "control").length,
    localDrafts: state.drafts.filter((item) => item.status === "draft" || item.status === "returned").length,
    pendingSync: state.drafts.filter((item) => item.status === "queued" || item.status === "returned").length,
    missingGps: state.submissions.filter((item) => item.latitude === null || item.longitude === null).length,
    poorGps: state.submissions.filter((item) => (item.gps_accuracy_meters ?? 0) > 50).length,
    missingVillage: state.submissions.filter((item) => !item.village).length,
    districts: districts.map((name) => ({ name, collected: state.submissions.filter((item) => item.district === name).length, approved: state.submissions.filter((item) => item.district === name && item.status === "approved").length })),
    modules,
  };
}

interface DashboardViewProps {
  metrics: DashboardMetrics;
  state: DashboardState;
  router: ReturnType<typeof useRouter>;
}

function SummaryCard({ tone, icon, label, value, note }: { tone: string; icon: string; label: string; value: number; note: string }) {
  return <article className={`summary-card ${tone}`}><span>{icon}</span><div><small>{label}</small><strong>{value.toLocaleString("en-IN")}</strong><p>{note}</p></div></article>;
}

function ProgressPanel({ metrics }: { metrics: DashboardMetrics }) {
  return <article className="dashboard-panel survey-progress"><PanelTitle icon="↗" title="Survey progress" /><div className="overall-progress"><div><span>Overall portfolio progress</span><b>{metrics.collected} <small>/ {metrics.target}</small></b><em>{percentage(metrics.collected, metrics.target)}%</em></div><ProgressBar value={percentage(metrics.collected, metrics.target)} /></div><div className="split-progress"><div><span>Awaiting quality review</span><b>{metrics.underReview}</b><ProgressBar value={percentage(metrics.underReview, Math.max(1, metrics.collected))} /><em>{percentage(metrics.underReview, Math.max(1, metrics.collected))}% of collected</em></div><div><span>Approved records</span><b>{metrics.approved}</b><ProgressBar value={percentage(metrics.approved, Math.max(1, metrics.collected))} /><em>{percentage(metrics.approved, Math.max(1, metrics.collected))}% of collected</em></div></div></article>;
}

function ModulePanel({ modules, collected, title = "Progress by analytical module" }: { modules: DashboardMetrics["modules"]; collected: number; title?: string }) {
  const denominator = Math.max(1, collected);
  const overall = collected && modules.length ? Math.round(modules.reduce((sum, item) => sum + percentage(item.count, denominator), 0) / modules.length) : 0;
  const gradient = modules.map((item, index) => `${item.color} ${index * (100 / modules.length)}% ${(index + 1) * (100 / modules.length)}%`).join(",");
  return <article className="dashboard-panel module-panel"><PanelTitle icon="▥" title={title} /><div className="module-panel-body"><div className="donut" style={{ background: overall ? `conic-gradient(${gradient})` : "#e8edef" }}><div><strong>{overall}%</strong><small>Overall</small></div></div><div className="module-legend">{modules.map((module) => <div key={module.name}><i style={{ background: module.color }} /><span>{module.name}</span><b>{module.count}/{collected || 0} ({collected ? percentage(module.count, denominator) : 0}%)</b></div>)}</div></div><p>Verified questionnaire records populate analytical coverage automatically. {collected ? "" : "No synchronized submissions yet."}</p></article>;
}

function DistrictPanel({ districts: items, title = "District progress", router }: { districts: DashboardMetrics["districts"]; title?: string; router: ReturnType<typeof useRouter> }) {
  return <article className="dashboard-panel district-panel"><PanelTitle icon="⌖" title={title} /><div className="district-panel-body">{items.map((district) => <div key={district.name}><header><strong>{district.name}</strong><span>{district.collected} collected<b>{district.approved} approved</b></span></header><ProgressBar value={percentage(district.approved, Math.max(1, district.collected))} /></div>)}</div><PanelButton label="Open GIS geography" onClick={() => router.push("/gis")} /></article>;
}

function GisAccessPanel({ submissions, router, title = "GIS monitoring" }: { submissions: DashboardSubmission[]; router: ReturnType<typeof useRouter>; title?: string }) {
  const points = submissions.filter((item) => item.latitude !== null && item.longitude !== null);
  return <article className="dashboard-panel gis-panel"><PanelTitle icon="⌖" title={title} /><div className="gis-access-card"><div><span>⌖</span><strong>{points.length} GPS-enabled survey location(s)</strong><p>The full GIS workspace uses real OpenStreetMap tiles, pan, zoom, clustering, privacy-safe popups, and operational filters.</p></div><ul><li><i className="approved" />{points.filter((item) => item.status === "approved").length} approved</li><li><i className="review" />{points.filter((item) => item.status === "submitted" || item.status === "under_review").length} under review</li><li><i className="concern" />{points.filter((item) => item.status === "returned").length} concerned</li></ul></div><PanelButton label="Open interactive GIS map" onClick={() => router.push("/gis")} /></article>;
}

function StudyPortfolioPanel({ studies, router }: { studies: StudyDefinition[]; router: ReturnType<typeof useRouter> }) {
  return <article className="dashboard-panel module-panel"><PanelTitle icon="▦" title="Study portfolio" /><div className="study-portfolio-list">{studies.slice(0, 5).map((study) => <button key={study.id} onClick={() => router.push(`/studies/${study.id}`)}><span className={`portfolio-status ${study.status}`} /><div><strong>{study.shortName}</strong><small>{study.code} · {study.studyType}</small></div><b>{study.targetSample.toLocaleString("en-IN")}</b></button>)}{studies.length === 0 && <EmptyLine text="No studies are cached on this device." />}</div><PanelButton label="Open all studies" onClick={() => router.push("/studies")} /></article>;
}

function OperationsPanel({ metrics, profiles, router }: { metrics: DashboardMetrics; profiles: DashboardProfile[]; router: ReturnType<typeof useRouter> }) {
  const activeEnumerators = profiles.filter((item) => item.active && item.role === "enumerator").length;
  return <article className="dashboard-panel operations-panel"><PanelTitle icon="♧" title="Field operations" /><MetricRows items={[["Active enumerators", activeEnumerators, "green"], ["Central submissions", metrics.collected, "green"], ["Local drafts", metrics.localDrafts, "teal"], ["Pending sync", metrics.pendingSync, "amber"]]} /><PanelButton label="Manage field users" onClick={() => router.push("/admin/users")} /></article>;
}

function AlertsPanel({ metrics, router }: { metrics: DashboardMetrics; router: ReturnType<typeof useRouter> }) {
  return <article className="dashboard-panel alerts-panel"><PanelTitle icon="!" title="Alerts" /><MetricRows items={[["GPS not captured", metrics.missingGps, "red"], ["GPS accuracy over 50 m", metrics.poorGps, "amber"], ["Returned surveys", metrics.returned, "red"], ["Records awaiting review", metrics.underReview, "purple"]]} /><PanelButton label="Open review queue" onClick={() => router.push("/review")} /></article>;
}

function PanelTitle({ icon, title }: { icon: string; title: string }) {
  return <header className="panel-title"><span>{icon}</span><h2>{title}</h2></header>;
}

function PanelButton({ label, onClick }: { label: string; onClick?: () => void }) {
  return <button className="panel-button" onClick={onClick}>{label}<span>→</span></button>;
}

function ProgressBar({ value }: { value: number }) {
  return <div className="dashboard-progress"><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

function ProgressRing({ value }: { value: number }) {
  return <div className="progress-ring" style={{ background: `conic-gradient(#45ad69 ${value}%, #e8edef ${value}% 100%)` }}><span><b>{value}%</b><small>approved</small></span></div>;
}

function MetricRows({ items }: { items: Array<[string, number, string]> }) {
  return <div className="metric-rows">{items.map(([label, value, tone]) => <div key={label}><span className={tone}>{tone === "red" ? "!" : tone === "amber" ? "⌖" : tone === "purple" ? "□" : "♧"}</span><p>{label}</p><b className={tone}>{value}</b></div>)}</div>;
}

function StatusDot({ status }: { status: SurveyStatus }) {
  return <span className={`status-dot ${status}`} />;
}

function EmptyLine({ text }: { text: string }) {
  return <div className="empty-line"><span>✓</span><p>{text}</p></div>;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";
}

function roleLabel(role: AppRole) {
  return role === "admin" ? "Administrator" : role === "researcher" ? "Researcher / Study Manager" : role === "supervisor" ? "Supervisor" : role === "reviewer" ? "Reviewer" : "Enumerator";
}

function formatStatus(status: SurveyStatus) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
