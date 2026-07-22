"use client";

import Link from "next/link";
import { useState } from "react";
import { CROP_CATEGORIES, CROP_TYPES, type CropCategory, type CropMasterRecord, type CropType, type CropVarietyRecord } from "@/config/crop-master";
import { useAdminMasterData } from "@/hooks/use-admin-master-data";
import { saveAdminMasterData, type AdminMasterData, type FpoFocusMapping } from "@/lib/admin-master-data";

type MasterArea = "settings" | "crops" | "varieties" | "fpo" | "audit";

const clone = (value: AdminMasterData) => structuredClone(value);

export function MasterDataPanel() {
  const stored = useAdminMasterData();
  const [draft, setDraft] = useState(() => clone(stored));
  const [active, setActive] = useState<MasterArea>("settings");
  const [notice, setNotice] = useState("");

  const commit = (area: string, previousValue: unknown, newValue: unknown, next: AdminMasterData) => {
    const { auditTrail: _ignored, ...withoutAudit } = next;
    void _ignored;
    saveAdminMasterData(withoutAudit, { area, previousValue, newValue });
    setNotice(`${area} saved with an audit record.`);
  };

  const saveSettings = () => {
    const youth = draft.youthAgeDefinition;
    const conversion = draft.landUnitConversion;
    if (youth.status === "Confirmed" && (youth.value.minimumAge === null || youth.value.maximumAge === null || youth.value.minimumAge > youth.value.maximumAge)) return setNotice("Enter a valid minimum and maximum youth age before confirming.");
    if (conversion.status === "Confirmed" && (!conversion.value.naliToAcre || !conversion.value.naliToHectare)) return setNotice("Enter both approved positive Nali conversion factors before confirming.");
    commit("Project definitions", { youthAgeDefinition: stored.youthAgeDefinition, landUnitConversion: stored.landUnitConversion }, { youthAgeDefinition: youth, landUnitConversion: conversion }, draft);
  };
  const saveCrops = () => {
    const names = draft.crops.map((crop) => crop.name.trim().toLowerCase());
    if (names.some((name) => !name) || new Set(names).size !== names.length) return setNotice("Every crop needs a unique, non-empty name.");
    if (draft.crops.some((crop) => crop.status === "Confirmed" && crop.cropType === "Other")) return setNotice("A confirmed crop needs an annual/seasonal or perennial/orchard classification.");
    commit("Crop Master", stored.crops, draft.crops, draft);
  };
  const saveVarieties = () => {
    if (draft.varieties.some((variety) => variety.approved && !variety.name.trim())) return setNotice("Approved varieties must have a name.");
    commit("Crop Variety Master", stored.varieties, draft.varieties, draft);
  };
  const saveMappings = () => {
    const validNames = new Set(draft.crops.filter((crop) => crop.active).map((crop) => crop.name.toLowerCase()));
    const invalid = draft.fpoFocusMappings.flatMap((mapping) => mapping.cropNames.filter((name) => !validNames.has(name.toLowerCase())));
    if (invalid.length) return setNotice(`Add or activate these crops in Crop Master before mapping them: ${[...new Set(invalid)].join(", ")}.`);
    commit("FPO Focus-Crop Mapping", stored.fpoFocusMappings, draft.fpoFocusMappings, draft);
  };

  const addCrop = () => setDraft((current) => ({ ...current, crops: [...current.crops, { id: crypto.randomUUID(), name: "", category: "Other", cropType: "Other", active: true, status: "Pending Confirmation" }] }));
  const updateCrop = (id: string, patch: Partial<CropMasterRecord>) => setDraft((current) => ({ ...current, crops: current.crops.map((crop) => crop.id === id ? { ...crop, ...patch } : crop) }));
  const addVariety = () => setDraft((current) => ({ ...current, varieties: [...current.varieties, { id: crypto.randomUUID(), cropId: current.crops[0]?.id ?? "", name: "", varietyType: "Unknown", active: true, approved: false }] }));
  const updateVariety = (id: string, patch: Partial<CropVarietyRecord>) => setDraft((current) => ({ ...current, varieties: current.varieties.map((variety) => variety.id === id ? { ...variety, ...patch } : variety) }));
  const updateMapping = (fpoName: string, patch: Partial<FpoFocusMapping>) => setDraft((current) => ({ ...current, fpoFocusMappings: current.fpoFocusMappings.map((mapping) => mapping.fpoName === fpoName ? { ...mapping, ...patch } : mapping) }));

  return <main className="admin-page">
    <header className="admin-topbar"><div><Link href="/">&larr; Dashboard</Link><span>UKIHDP Administration</span></div><b>Admin configuration preview</b></header>
    <section className="admin-heading"><div><p>Controlled study configuration</p><h1>Master data</h1><span>Manage the definitions that drive field forms, calculations and FPO-specific crop routing.</span></div><div className="admin-security"><strong>Production security note</strong><span>This screen must be protected by Supabase Admin authorization before live deployment. Local changes currently stay in this browser.</span></div></section>
    <nav className="admin-tabs">{([['settings','Definitions'],['crops','Crop master'],['varieties','Varieties'],['fpo','FPO mappings'],['audit','Audit history']] as [MasterArea,string][]).map(([id,label]) => <button className={active === id ? "active" : ""} key={id} onClick={() => { setActive(id); setNotice(""); }}>{label}</button>)}</nav>
    {notice && <div className="admin-notice">{notice}</div>}

    {active === "settings" && <section className="admin-panel"><header><div><p>Pending project decisions</p><h2>Youth and land-unit definitions</h2></div><span>Never inferred automatically</span></header><div className="admin-setting-grid"><article><h3>Youth age definition</h3><p>The household roster will classify youth only after this range is confirmed.</p><label>Minimum age<input type="number" min="0" value={draft.youthAgeDefinition.value.minimumAge ?? ""} onChange={(event) => setDraft((current) => ({ ...current, youthAgeDefinition: { ...current.youthAgeDefinition, value: { ...current.youthAgeDefinition.value, minimumAge: event.target.value === "" ? null : Number(event.target.value) } } }))} /></label><label>Maximum age<input type="number" min="0" value={draft.youthAgeDefinition.value.maximumAge ?? ""} onChange={(event) => setDraft((current) => ({ ...current, youthAgeDefinition: { ...current.youthAgeDefinition, value: { ...current.youthAgeDefinition.value, maximumAge: event.target.value === "" ? null : Number(event.target.value) } } }))} /></label><StatusSelect value={draft.youthAgeDefinition.status} update={(status) => setDraft((current) => ({ ...current, youthAgeDefinition: { ...current.youthAgeDefinition, status } }))} /></article><article><h3>Nali conversion factors</h3><p>Original Nali values are always preserved. Analytical conversion begins only after confirmation.</p><label>1 Nali in acres<input type="number" min="0" step="any" value={draft.landUnitConversion.value.naliToAcre ?? ""} onChange={(event) => setDraft((current) => ({ ...current, landUnitConversion: { ...current.landUnitConversion, value: { ...current.landUnitConversion.value, naliToAcre: event.target.value === "" ? null : Number(event.target.value) } } }))} /></label><label>1 Nali in hectares<input type="number" min="0" step="any" value={draft.landUnitConversion.value.naliToHectare ?? ""} onChange={(event) => setDraft((current) => ({ ...current, landUnitConversion: { ...current.landUnitConversion, value: { ...current.landUnitConversion.value, naliToHectare: event.target.value === "" ? null : Number(event.target.value) } } }))} /></label><StatusSelect value={draft.landUnitConversion.status} update={(status) => setDraft((current) => ({ ...current, landUnitConversion: { ...current.landUnitConversion, status } }))} /></article></div><footer><button onClick={saveSettings}>Save definitions</button></footer></section>}

    {active === "crops" && <section className="admin-panel"><header><div><p>Questionnaire dropdown source</p><h2>Crop Master</h2></div><button className="admin-add" onClick={addCrop}>+ Add crop</button></header><div className="admin-table-wrap"><table><thead><tr><th>Crop name</th><th>Category</th><th>Classification</th><th>Approval</th><th>Active</th></tr></thead><tbody>{draft.crops.map((crop) => <tr key={crop.id}><td><input value={crop.name} placeholder="Crop name" onChange={(event) => updateCrop(crop.id, { name: event.target.value })} /></td><td><select value={crop.category} onChange={(event) => updateCrop(crop.id, { category: event.target.value as CropCategory })}>{CROP_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></td><td><select value={crop.cropType} onChange={(event) => updateCrop(crop.id, { cropType: event.target.value as CropType })}>{CROP_TYPES.map((item) => <option key={item}>{item}</option>)}</select></td><td><select value={crop.status} onChange={(event) => updateCrop(crop.id, { status: event.target.value as CropMasterRecord['status'] })}><option>Confirmed</option><option>Pending Confirmation</option></select></td><td><input type="checkbox" checked={crop.active} onChange={(event) => updateCrop(crop.id, { active: event.target.checked })} /></td></tr>)}</tbody></table></div><footer><span>No benchmark yields or unapproved crops are generated.</span><button onClick={saveCrops}>Save Crop Master</button></footer></section>}

    {active === "varieties" && <section className="admin-panel"><header><div><p>Approved crop-specific options</p><h2>Crop Variety Master</h2></div><button className="admin-add" onClick={addVariety}>+ Add variety</button></header>{draft.varieties.length ? <div className="admin-table-wrap"><table><thead><tr><th>Crop</th><th>Variety</th><th>Type</th><th>Approved</th><th>Active</th></tr></thead><tbody>{draft.varieties.map((variety) => <tr key={variety.id}><td><select value={variety.cropId} onChange={(event) => updateVariety(variety.id, { cropId: event.target.value })}>{draft.crops.filter((crop) => crop.active).map((crop) => <option key={crop.id} value={crop.id}>{crop.name || "Unnamed crop"}</option>)}</select></td><td><input value={variety.name} placeholder="Approved variety name" onChange={(event) => updateVariety(variety.id, { name: event.target.value })} /></td><td><select value={variety.varietyType} onChange={(event) => updateVariety(variety.id, { varietyType: event.target.value as CropVarietyRecord['varietyType'] })}>{["Local / Traditional","Improved","Hybrid","Other","Unknown"].map((item) => <option key={item}>{item}</option>)}</select></td><td><input type="checkbox" checked={variety.approved} onChange={(event) => updateVariety(variety.id, { approved: event.target.checked })} /></td><td><input type="checkbox" checked={variety.active} onChange={(event) => updateVariety(variety.id, { active: event.target.checked })} /></td></tr>)}</tbody></table></div> : <div className="admin-empty"><strong>No varieties have been invented.</strong><p>Add only approved crop varieties. Enumerator entries under “Other - Specify” remain response data and are flagged for later Admin review.</p></div>}<footer><button onClick={saveVarieties}>Save Variety Master</button></footer></section>}

    {active === "fpo" && <section className="admin-panel"><header><div><p>Automatic survey routing</p><h2>FPO focus-crop mappings</h2></div><span>{draft.fpoFocusMappings.length} FPOs configured</span></header><div className="mapping-list">{draft.fpoFocusMappings.map((mapping) => <article key={mapping.fpoName}><strong>{mapping.fpoName}</strong><label>Focus crops, comma separated<input value={mapping.cropNames.join(", ")} onChange={(event) => updateMapping(mapping.fpoName, { cropNames: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} /></label><StatusSelect value={mapping.status} update={(status) => updateMapping(mapping.fpoName, { status })} /></article>)}</div><footer><span>Changes affect automatic focus-crop matching in Section 3.</span><button onClick={saveMappings}>Save FPO mappings</button></footer></section>}

    {active === "audit" && <section className="admin-panel"><header><div><p>Configuration governance</p><h2>Audit history</h2></div><span>{stored.auditTrail.length} recorded changes</span></header>{stored.auditTrail.length ? <div className="audit-list">{stored.auditTrail.map((record) => <article key={record.id}><div><strong>{record.area}</strong><span>{record.changedBy}</span></div><time>{new Date(record.changedAt).toLocaleString()}</time><details><summary>View previous and new values</summary><div><pre>{JSON.stringify(record.previousValue, null, 2)}</pre><pre>{JSON.stringify(record.newValue, null, 2)}</pre></div></details></article>)}</div> : <div className="admin-empty"><strong>No configuration changes recorded yet.</strong><p>The first saved change will record the previous value, new value, administrator label and timestamp.</p></div>}</section>}
  </main>;
}

function StatusSelect({ value, update }: { value: "Confirmed" | "Pending Confirmation"; update: (value: "Confirmed" | "Pending Confirmation") => void }) {
  return <label>Status<select value={value} onChange={(event) => update(event.target.value as "Confirmed" | "Pending Confirmation")}><option>Pending Confirmation</option><option>Confirmed</option></select></label>;
}
