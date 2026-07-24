"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { AccessGate } from "@/components/auth/access-gate";
import { useAuth } from "@/components/auth/auth-provider";
import { listSurveyDrafts } from "@/lib/offline-drafts";
import { listStudies } from "@/lib/studies/study-catalog";
import type { StudyDefinition } from "@/lib/studies/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { SurveyStatus } from "@/lib/survey/types";
import { deleteLocalStudyLocation, listLocalStudyLocations, saveLocalStudyLocation, type StudyLocationType } from "@/lib/gis/study-locations";

interface MapPoint {
  id: string;
  studyId: string;
  studyName: string;
  district: string;
  block: string;
  fpo: string;
  village: string;
  sampleGroup: string;
  status: SurveyStatus;
  enumerator: string;
  surveyDate: string;
  latitude: number;
  longitude: number;
  locationType: "survey" | StudyLocationType;
  name?: string;
  description?: string;
  source: "central" | "device";
}

const emptyFilters = { study: "", district: "", block: "", fpo: "", village: "", sampleGroup: "", enumerator: "", status: "", from: "", to: "" };
const emptyLocation = { studyId: "", locationType: "study" as StudyLocationType, name: "", description: "", district: "", block: "", village: "", latitude: "", longitude: "" };

export function GisWorkspace() { return <AccessGate><GisContent /></AccessGate>; }

function GisContent() {
  const auth = useAuth();
  const [studies, setStudies] = useState<StudyDefinition[]>([]);
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [locationForm, setLocationForm] = useState(emptyLocation);
  const [showLocationForm, setShowLocationForm] = useState(false);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => void (async () => {
      const studyItems = await listStudies();
      const requestedStudy = new URLSearchParams(window.location.search).get("study") ?? "";
      if (requestedStudy) setFilters((current) => ({ ...current, study: requestedStudy }));
      const [localDrafts, localLocations] = await Promise.all([listSurveyDrafts().catch(() => []), listLocalStudyLocations().catch(() => [])]);
      const localPoints: MapPoint[] = localDrafts.flatMap((draft) => {
        const answers = (draft.sectionData.answers ?? {}) as Record<string, unknown>;
        const gps = answers["1.11"] as Record<string, unknown> | undefined;
        const latitude = Number(gps?.latitude);
        const longitude = Number(gps?.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
        const study = studyItems.find((item) => item.id === draft.studyId) ?? studyItems[0];
        return [{ id: draft.id, studyId: study?.id ?? "", studyName: study?.shortName ?? draft.studyName ?? "Field study", district: String(answers["1.5"] ?? ""), block: String(answers["1.6"] ?? ""), fpo: String(answers["1.7"] ?? answers["11.1"] ?? ""), village: String(answers["1.8"] ?? ""), sampleGroup: String(answers["1.4"] ?? ""), status: draft.status, enumerator: auth.profile?.displayName ?? "Current device user", surveyDate: draft.updatedAt, latitude, longitude, locationType: "survey" as const, source: "device" as const }];
      });

      const localConfiguredPoints: MapPoint[] = localLocations.map((location) => {
        const study = studyItems.find((item) => item.id === location.studyId);
        return { id: location.id, studyId: location.studyId, studyName: study?.shortName ?? "Field study", district: location.district, block: location.block, fpo: "", village: location.village, sampleGroup: "", status: location.locationType === "concern" ? "returned" : "approved", enumerator: "Study management", surveyDate: location.updatedAt, latitude: location.latitude, longitude: location.longitude, locationType: location.locationType, name: location.name, description: location.description, source: "device" };
      });

      const client = getSupabaseBrowserClient();
      let centralPoints: MapPoint[] = [];
      let centralConfiguredPoints: MapPoint[] = [];
      if (client && auth.user && !auth.testMode) {
        const full = await client.from("survey_submissions").select("id, client_generated_id, study_id, status, study_group, district, block, fpo_cluster, village, latitude, longitude, enumerator_id, created_at, submitted_at").not("latitude", "is", null).not("longitude", "is", null);
        const fallback = full.error ? await client.from("survey_submissions").select("id, client_generated_id, status, study_group, district, block, fpo_cluster, village, latitude, longitude, enumerator_id, created_at, submitted_at").not("latitude", "is", null).not("longitude", "is", null) : null;
        const records = full.error ? (fallback?.data ?? []).map((record) => ({ ...record, study_id: studyItems[0]?.id })) : (full.data ?? []);
        const profileIds = [...new Set(records.map((record) => record.enumerator_id).filter(Boolean))];
        const profileResult = profileIds.length ? await client.from("profiles").select("id, display_name").in("id", profileIds) : { data: [] };
        const names = new Map((profileResult.data ?? []).map((profile) => [profile.id, profile.display_name]));
        centralPoints = records.map((record) => {
          const study = studyItems.find((item) => item.id === record.study_id) ?? studyItems[0];
          return { id: String(record.client_generated_id ?? record.id), studyId: study?.id ?? "", studyName: study?.shortName ?? "Field study", district: record.district ?? "", block: record.block ?? "", fpo: record.fpo_cluster ?? "", village: record.village ?? "", sampleGroup: record.study_group ?? "", status: record.status as SurveyStatus, enumerator: names.get(record.enumerator_id) ?? "Assigned field user", surveyDate: record.submitted_at ?? record.created_at, latitude: Number(record.latitude), longitude: Number(record.longitude), locationType: "survey", source: "central" };
        });
        const locationResult = await client.from("study_locations").select("id, study_id, location_type, name, description, district, block, village, latitude, longitude, updated_at").eq("active", true);
        if (!locationResult.error) centralConfiguredPoints = (locationResult.data ?? []).map((location) => {
          const study = studyItems.find((item) => item.id === location.study_id);
          return { id: location.id, studyId: location.study_id, studyName: study?.shortName ?? "Field study", district: location.district ?? "", block: location.block ?? "", fpo: "", village: location.village ?? "", sampleGroup: "", status: location.location_type === "concern" ? "returned" : "approved", enumerator: "Study management", surveyDate: location.updated_at, latitude: Number(location.latitude), longitude: Number(location.longitude), locationType: location.location_type as StudyLocationType, name: location.name, description: location.description ?? "", source: "central" };
        });
        if (full.error && !String(full.error.message).includes("study_id")) setMessage(full.error.message);
      }
      const centralIds = new Set(centralPoints.map((point) => point.id));
      const centralLocationIds = new Set(centralConfiguredPoints.map((point) => point.id));
      if (active) { setStudies(studyItems); setPoints([...centralConfiguredPoints, ...centralPoints, ...localConfiguredPoints.filter((point) => !centralLocationIds.has(point.id)), ...localPoints.filter((point) => !centralIds.has(point.id))]); setLoading(false); }
    })(), 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [auth.profile?.displayName, auth.testMode, auth.user]);

  const selectedStudy = studies.find((study) => study.id === filters.study);
  const showFpo = !selectedStudy || Boolean(selectedStudy.builtIn);
  const showSampleGroup = !selectedStudy || selectedStudy.treatmentTarget !== undefined || selectedStudy.controlTarget !== undefined;
  const filtered = useMemo(() => points.filter((point) => {
    if (filters.study && point.studyId !== filters.study) return false;
    if (filters.district && point.district !== filters.district) return false;
    if (filters.block && point.block !== filters.block) return false;
    if (filters.fpo && point.fpo !== filters.fpo) return false;
    if (filters.village && point.village !== filters.village) return false;
    if (filters.sampleGroup && point.sampleGroup.toLowerCase() !== filters.sampleGroup) return false;
    if (filters.enumerator && point.enumerator !== filters.enumerator) return false;
    if (filters.status && point.status !== filters.status) return false;
    if (filters.from && point.surveyDate.slice(0, 10) < filters.from) return false;
    if (filters.to && point.surveyDate.slice(0, 10) > filters.to) return false;
    return true;
  }), [filters, points]);
  const options = (key: keyof Pick<MapPoint, "district" | "block" | "fpo" | "village" | "enumerator">) => [...new Set(points.filter((point) => !filters.study || point.studyId === filters.study).map((point) => point[key]).filter(Boolean))].sort();
  const setFilter = (key: keyof typeof filters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const canManageLocations = auth.profile?.role === "admin" || auth.profile?.role === "researcher";

  async function addLocation(event: React.FormEvent) {
    event.preventDefault();
    const studyId = locationForm.studyId || filters.study || studies[0]?.id;
    const latitude = Number(locationForm.latitude);
    const longitude = Number(locationForm.longitude);
    if (!studyId || !locationForm.name.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      setMessage("Select a study, add a location name, and enter valid latitude and longitude values.");
      return;
    }
    const id = crypto.randomUUID();
    const updatedAt = new Date().toISOString();
    const saved = { id, studyId, locationType: locationForm.locationType, name: locationForm.name.trim(), description: locationForm.description.trim(), district: locationForm.district.trim(), block: locationForm.block.trim(), village: locationForm.village.trim(), latitude, longitude, updatedAt };
    await saveLocalStudyLocation(saved);
    const study = studies.find((item) => item.id === studyId);
    setPoints((current) => [{ id, studyId, studyName: study?.shortName ?? "Field study", district: saved.district, block: saved.block, fpo: "", village: saved.village, sampleGroup: "", status: saved.locationType === "concern" ? "returned" : "approved", enumerator: "Study management", surveyDate: updatedAt, latitude, longitude, locationType: saved.locationType, name: saved.name, description: saved.description, source: "device" }, ...current]);
    const client = getSupabaseBrowserClient();
    if (client && auth.user && !auth.testMode) {
      const result = await client.from("study_locations").insert({ id, study_id: studyId, location_type: saved.locationType, name: saved.name, description: saved.description || null, district: saved.district || null, block: saved.block || null, village: saved.village || null, latitude, longitude, created_by: auth.user.id });
      setMessage(result.error ? `Location is saved on this device but central synchronization needs attention: ${result.error.message}` : "Location saved to the study GIS.");
    } else setMessage("Location saved on this device for local testing and offline use.");
    setLocationForm(emptyLocation);
    setShowLocationForm(false);
  }

  async function removeLocation(id: string) {
    await deleteLocalStudyLocation(id).catch(() => undefined);
    const client = getSupabaseBrowserClient();
    if (client && auth.user && !auth.testMode) await client.from("study_locations").update({ active: false }).eq("id", id);
    setPoints((current) => current.filter((point) => point.id !== id));
    setMessage("Configured location removed from the active GIS view.");
  }

  return <main className="gis-page">
    <header className="gis-topbar"><div><Link href="/">← Dashboard</Link><span>FieldFlow · GIS monitoring</span></div><b>{filtered.length} visible locations</b></header>
    <section className="gis-heading"><div><p>Real survey geography</p><h1>GIS Monitoring</h1><span>Interactive OpenStreetMap tiles, survey GPS points, study sites, and operational concerns.</span></div><div>{canManageLocations && <button className="location-create" onClick={() => { setLocationForm((current) => ({ ...current, studyId: filters.study || studies[0]?.id || "" })); setShowLocationForm((current) => !current); }}>+ Add study location</button>}<i className="online-dot" />Non-sensitive operational view</div></section>
    {message && <div className="gis-message">{message}</div>}
    {showLocationForm && canManageLocations && <form className="location-form" onSubmit={(event) => void addLocation(event)}><label>Study<select value={locationForm.studyId} onChange={(event) => setLocationForm((current) => ({ ...current, studyId: event.target.value }))}>{studies.map((study) => <option key={study.id} value={study.id}>{study.shortName}</option>)}</select></label><label>Location type<select value={locationForm.locationType} onChange={(event) => setLocationForm((current) => ({ ...current, locationType: event.target.value as StudyLocationType }))}><option value="study">Study site</option><option value="project">Project location</option><option value="concern">Concern / flagged site</option></select></label><label>Name<input required value={locationForm.name} onChange={(event) => setLocationForm((current) => ({ ...current, name: event.target.value }))} /></label><label>District<input value={locationForm.district} onChange={(event) => setLocationForm((current) => ({ ...current, district: event.target.value }))} /></label><label>Block<input value={locationForm.block} onChange={(event) => setLocationForm((current) => ({ ...current, block: event.target.value }))} /></label><label>Village<input value={locationForm.village} onChange={(event) => setLocationForm((current) => ({ ...current, village: event.target.value }))} /></label><label>Latitude<input required inputMode="decimal" value={locationForm.latitude} onChange={(event) => setLocationForm((current) => ({ ...current, latitude: event.target.value }))} placeholder="30.123456" /></label><label>Longitude<input required inputMode="decimal" value={locationForm.longitude} onChange={(event) => setLocationForm((current) => ({ ...current, longitude: event.target.value }))} placeholder="79.123456" /></label><label className="location-description">Description<textarea value={locationForm.description} onChange={(event) => setLocationForm((current) => ({ ...current, description: event.target.value }))} /></label><button type="submit">Save location</button></form>}
    <section className="gis-filter-panel"><label>Study<select value={filters.study} onChange={(event) => setFilter("study", event.target.value)}><option value="">All studies</option>{studies.map((study) => <option key={study.id} value={study.id}>{study.shortName}</option>)}</select></label><Filter label="District" value={filters.district} values={options("district")} onChange={(value) => setFilter("district", value)} /><Filter label="Block" value={filters.block} values={options("block")} onChange={(value) => setFilter("block", value)} />{showFpo && <Filter label="FPO" value={filters.fpo} values={options("fpo")} onChange={(value) => setFilter("fpo", value)} />}<Filter label="Village" value={filters.village} values={options("village")} onChange={(value) => setFilter("village", value)} />{showSampleGroup && <label>Sample group<select value={filters.sampleGroup} onChange={(event) => setFilter("sampleGroup", event.target.value)}><option value="">All groups</option><option value="treatment">Treatment</option><option value="control">Control</option></select></label>}<Filter label="Enumerator" value={filters.enumerator} values={options("enumerator")} onChange={(value) => setFilter("enumerator", value)} /><label>Status<select value={filters.status} onChange={(event) => setFilter("status", event.target.value)}><option value="">All statuses</option><option value="draft">Draft</option><option value="queued">Pending sync</option><option value="submitted">Submitted</option><option value="under_review">Under review</option><option value="returned">Concern / returned</option><option value="approved">Approved</option></select></label><label>From<input type="date" value={filters.from} onChange={(event) => setFilter("from", event.target.value)} /></label><label>To<input type="date" value={filters.to} onChange={(event) => setFilter("to", event.target.value)} /></label><button onClick={() => setFilters(emptyFilters)}>Clear filters</button></section>
    <section className="gis-layout"><article className="map-card"><header><div><strong>Survey and study locations</strong><span>Pan, zoom, cluster, select, and toggle layers for visible GPS points.</span></div><div className="map-legend"><span><i className="approved" />Completed / approved</span><span><i className="ongoing" />Ongoing / draft</span><span><i className="review" />Under review</span><span><i className="concern" />Concern / flagged</span></div></header>{loading ? <div className="map-loading">Loading GPS records…</div> : <ActualMap points={filtered} />}</article><aside className="gis-summary"><h2>Location status</h2><StatusMetric label="Survey GPS points" value={filtered.filter((point) => point.locationType === "survey").length} tone="blue" /><StatusMetric label="Study / project sites" value={filtered.filter((point) => point.locationType === "study" || point.locationType === "project").length} tone="green" /><StatusMetric label="Under review" value={filtered.filter((point) => point.status === "submitted" || point.status === "under_review").length} tone="purple" /><StatusMetric label="Concern / returned" value={filtered.filter((point) => point.status === "returned").length} tone="red" />{canManageLocations && <div className="configured-locations"><strong>Configured locations</strong>{filtered.filter((point) => point.locationType !== "survey").slice(0, 6).map((point) => <div key={point.id}><span>{point.name || point.village || "Mapped location"}</span><button onClick={() => void removeLocation(point.id)}>Remove</button></div>)}</div>}<div className="privacy-note"><strong>Privacy protected</strong><p>Respondent name, phone number, and exact personal address are never displayed in GIS popups.</p></div></aside></section>
  </main>;
}

function ActualMap({ points }: { points: MapPoint[] }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const layersRef = useRef<Record<"survey" | "study" | "concern", Leaflet.MarkerClusterGroup> | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const pointsRef = useRef(points);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!container.current || mapRef.current) return;
      const browserWindow = window as unknown as { L?: typeof Leaflet };
      let L = browserWindow.L;
      if (!L || !Object.isExtensible(L)) {
        L = Object.assign({}, await import("leaflet")) as typeof Leaflet;
        browserWindow.L = L;
      }
      if (!("markerClusterGroup" in L)) await import("leaflet.markercluster");
      if (cancelled || !container.current) return;
      const map = L.map(container.current, { zoomControl: true }).setView([30.1, 79.3], 7);
      const baseMap = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
      const survey = L.markerClusterGroup({ maxClusterRadius: 45, showCoverageOnHover: false }).addTo(map);
      const study = L.markerClusterGroup({ maxClusterRadius: 35, showCoverageOnHover: false }).addTo(map);
      const concern = L.markerClusterGroup({ maxClusterRadius: 30, showCoverageOnHover: false }).addTo(map);
      L.control.layers({ "OpenStreetMap": baseMap }, { "Survey GPS points": survey, "Study / project locations": study, "Concern locations": concern }, { collapsed: false }).addTo(map);
      const layers = { survey, study, concern };
      mapRef.current = map; layersRef.current = layers; leafletRef.current = L;
      drawPoints(L, map, layers, pointsRef.current);
    })();
    return () => { cancelled = true; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; layersRef.current = null; leafletRef.current = null; } };
  }, []);
  useEffect(() => {
    pointsRef.current = points;
    if (leafletRef.current && mapRef.current && layersRef.current) drawPoints(leafletRef.current, mapRef.current, layersRef.current, points);
  }, [points]);
  return <div ref={container} className="actual-map" aria-label="Interactive GIS map" />;
}

function drawPoints(L: typeof Leaflet, map: Leaflet.Map, layers: Record<"survey" | "study" | "concern", Leaflet.MarkerClusterGroup>, points: MapPoint[]) {
  Object.values(layers).forEach((layer) => layer.clearLayers());
  points.forEach((point) => {
    const category = point.status === "approved" ? "approved" : point.status === "returned" ? "concern" : point.status === "submitted" || point.status === "under_review" ? "review" : "ongoing";
    const icon = L.divIcon({ className: "fieldflow-map-icon", html: `<span class="${category}"></span>`, iconSize: [18, 18], iconAnchor: [9, 9] });
    const layerKey = point.locationType === "concern" ? "concern" : point.locationType === "survey" ? "survey" : "study";
    const title = point.name || (point.locationType === "survey" ? point.id : "Mapped study location");
    const details = point.locationType === "survey" ? `<dt>Sample group</dt><dd>${escapeHtml(point.sampleGroup || "Not applicable")}</dd><dt>Status</dt><dd>${escapeHtml(point.status.replaceAll("_", " "))}</dd><dt>Enumerator</dt><dd>${escapeHtml(point.enumerator)}</dd><dt>Survey date</dt><dd>${escapeHtml(new Date(point.surveyDate).toLocaleDateString("en-IN"))}</dd>` : `<dt>Location type</dt><dd>${escapeHtml(point.locationType)}</dd><dt>Description</dt><dd>${escapeHtml(point.description || "No description")}</dd>`;
    L.marker([point.latitude, point.longitude], { icon }).bindPopup(`<div class="safe-popup"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(point.studyName)}</span><dl><dt>District</dt><dd>${escapeHtml(point.district || "—")}</dd><dt>Block</dt><dd>${escapeHtml(point.block || "—")}</dd><dt>Village</dt><dd>${escapeHtml(point.village || "—")}</dd>${details}</dl></div>`).addTo(layers[layerKey]);
  });
  if (points.length) {
    const bounds = L.latLngBounds(points.map((point) => [point.latitude, point.longitude] as [number, number]));
    map.fitBounds(bounds.pad(.18), { maxZoom: 14 });
  } else map.setView([30.1, 79.3], 7);
}

function Filter({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) { return <label>{label}<select value={value} onChange={(event) => onChange(event.target.value)}><option value="">All</option>{values.map((item) => <option key={item}>{item}</option>)}</select></label>; }
function StatusMetric({ label, value, tone }: { label: string; value: number; tone: string }) { return <div className="status-metric"><i className={tone} /><span>{label}</span><b>{value}</b></div>; }
function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;" })[character] ?? character); }
