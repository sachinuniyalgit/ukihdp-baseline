"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { baselineQuestionnaire } from "@/config/questionnaire-outline";
import { useAuth } from "@/components/auth/auth-provider";

const navigation = ["Overview", "New survey", "My drafts", "Review queue", "Field progress", "GIS monitoring", "Results", "Reports", "Master data"];
const districts = ["Pithoragarh", "Nainital", "Uttarkashi", "Tehri Garhwal"];

function subscribeToConnectivity(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export default function Home() {
  const router = useRouter();
  const auth = useAuth();
  const [active, setActive] = useState("Overview");
  const online = useSyncExternalStore(subscribeToConnectivity, () => navigator.onLine, () => true);
  const showOutline = active === "New survey";

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span>U</span><div><b>UKIHDP</b><small>Baseline assessment</small></div></div>
      <nav>{navigation.map((item) => <button key={item} className={active === item ? "active" : ""} onClick={() => item === "New survey" ? router.push("/survey/new") : item === "My drafts" ? router.push("/drafts") : item === "Review queue" ? router.push("/review") : item === "Master data" ? router.push("/admin/master-data") : setActive(item)}>{item}</button>)}</nav>
      <div className="sidebar-foot"><i /> Field workspace ready<br/><small>{auth.demoMode ? "Local preview mode" : "Secure central database"}</small></div>
    </aside>

    <section className="content">
      <header className="topbar">
        <div><p>UKIHDP / {active}</p><h1>Baseline Assessment Platform</h1></div>
        <div className="top-actions">
          <button className={online ? "connection online" : "connection offline"} aria-label="Current internet connection status"><i />{online ? "Online" : "Offline"}</button>
          <button className="profile" aria-label="Open secure login or profile" onClick={() => auth.user ? auth.signOut() : router.push("/login")}>{auth.profile ? auth.profile.displayName.slice(0, 2).toUpperCase() : auth.demoMode ? "LP" : "IN"}</button>
        </div>
      </header>

      <section className="intro-card">
        <div><p className="green-label">{auth.demoMode ? "Local preview ready" : "Secure database connected"}</p><h2>A reliable field-to-evidence workflow</h2><p>Mobile data collection, role-based access, offline drafts, secure synchronization, review decisions, and configurable survey instruments work as one connected flow.</p></div>
        <button className="primary" onClick={() => router.push("/survey/new")}>Start questionnaire <span aria-hidden>&rarr;</span></button>
      </section>

      {showOutline && <section className="outline-panel" aria-label="Questionnaire outline">
        <header><div><p>Configurable survey engine</p><h2>{baselineQuestionnaire.sections.length} approved information areas</h2></div><b>Outline only</b></header>
        <div className="section-list">{baselineQuestionnaire.sections.map((section) => <article key={section.id}>
          <span>{String(section.order).padStart(2, "0")}</span>
          <div><strong>{section.title}</strong><p>{section.description}</p></div>
          <em>{section.instrument === "institutional" ? "Separate FPO tool" : "Household survey"}</em>
        </article>)}</div>
      </section>}

      <section className="metrics">
        <article><em className="navy">01</em><div><small>Sample target</small><strong>960</strong><p>640 treatment / 320 control</p></div></article>
        <article><em className="teal">DB</em><div><small>Survey status</small><strong>Pilot ready</strong><p>Household + FPO instruments</p></div></article>
        <article><em className="forest">GPS</em><div><small>Project coverage</small><strong>4 districts</strong><p>16 FPO analytical clusters</p></div></article>
        <article><em className="amber">PWA</em><div><small>Offline capability</small><strong>Sync ready</strong><p>Local drafts + reconnect queue</p></div></article>
      </section>

      <section className="grid">
        <article className="panel workflow"><header><div><p>Implementation pathway</p><h2>Survey workflow</h2></div><b>Modular</b></header><ol>{["Questionnaire engine", "Offline save & sync", "Review & approval", "Verified data", "Maps, results & reports"].map((step, index) => <li key={step}><span>{index + 1}</span>{step}</li>)}</ol></article>
        <article className="panel progress"><header><div><p>Coverage planning</p><h2>District targets</h2></div><b>Baseline</b></header>{districts.map((district) => <div className="district" key={district}><div><strong>{district}</strong><small>0 of 240 approved</small></div><div className="bar"><i /></div></div>)}<footer>Approved survey records will populate progress automatically.</footer></article>
        <article className="panel roles"><header><div><p>Secure access</p><h2>Role-ready platform</h2></div></header>{[["E", "Enumerator", "Complete mobile surveys, save offline drafts, and submit records."], ["R", "Reviewer", "Check submissions, request corrections, and approve verified records."], ["A", "Admin / Researcher", "Manage users, master data, reporting, and study-wide analysis."]].map(([icon, title, text]) => <div className="role" key={title}><span>{icon}</span><div><strong>{title}</strong><p>{text}</p></div></div>)}</article>
        <article className="panel map"><header><div><p>Spatial monitoring</p><h2>GIS foundation</h2></div><b>GPS protected</b></header><div className="map-view"><div className="contours" /><span className="pin one">&#9679;</span><span className="pin two">&#9679;</span><span className="pin three">&#9679;</span><div>Approved GPS-enabled survey points will appear here without exposing household identities.</div></div></article>
      </section>

      <section className="next"><div><p>Questionnaire available</p><h2>Household and FPO instruments implemented</h2><span>Field options, repeatable rosters, skip logic, calculations, GPS, local drafts, and quality-control fields are ready for configuration testing.</span></div><button onClick={() => router.push("/survey/new")}>Open questionnaire</button></section>
    </section>
  </main>;
}
