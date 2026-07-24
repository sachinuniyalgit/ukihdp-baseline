"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { useAuth } from "@/components/auth/auth-provider";
import { listStudies } from "@/lib/studies/study-catalog";
import type { StudyDefinition } from "@/lib/studies/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { testAccounts } from "@/lib/test-accounts";
import type { AppRole } from "@/lib/survey/types";

interface ManagedProfile {
  id: string; display_name: string; email: string | null; role: AppRole; requested_role: AppRole | null; active: boolean; created_at: string;
  profile_photo_url?: string | null; gender?: string | null; date_of_birth?: string | null; primary_mobile?: string | null; alternate_mobile?: string | null;
  alternate_email?: string | null; address_line_1?: string | null; address_line_2?: string | null; city?: string | null; district?: string | null; state?: string | null;
  postal_code?: string | null; country?: string | null; organisation?: string | null; department?: string | null; designation?: string | null; staff_id?: string | null;
  username?: string | null; last_login?: string | null; last_active?: string | null; last_sync?: string | null; surveys_completed?: number; assignments?: AssignmentView[];
}

interface AssignmentView { id: string; study_id: string; study_name: string; role_in_study: string; district?: string | null; block?: string | null; fpo?: string | null; villages?: string[]; active: boolean }

const roleLabels: Record<AppRole, string> = { admin: "Administrator", researcher: "Researcher / Study Manager", supervisor: "Supervisor", reviewer: "Reviewer", enumerator: "Enumerator" };
const profileFields: Array<{ key: keyof ManagedProfile; label: string; type?: string; wide?: boolean }> = [
  { key: "display_name", label: "Full name", wide: true }, { key: "profile_photo_url", label: "Profile photo URL", wide: true }, { key: "gender", label: "Gender (optional)" }, { key: "date_of_birth", label: "Date of birth", type: "date" },
  { key: "primary_mobile", label: "Primary mobile" }, { key: "alternate_mobile", label: "Alternate mobile" }, { key: "email", label: "Email address" }, { key: "alternate_email", label: "Alternate email" },
  { key: "address_line_1", label: "Address line 1", wide: true }, { key: "address_line_2", label: "Address line 2", wide: true }, { key: "city", label: "Village / Town / City" }, { key: "district", label: "District" },
  { key: "state", label: "State" }, { key: "postal_code", label: "PIN / Postal code" }, { key: "country", label: "Country" }, { key: "organisation", label: "Organisation" },
  { key: "department", label: "Department / Unit" }, { key: "designation", label: "Designation" }, { key: "staff_id", label: "Employee / Staff ID" }, { key: "username", label: "Username" },
];

export function UserManagementPanel() {
  const auth = useAuth();
  const client = useMemo(() => getSupabaseBrowserClient(), []);
  const [profiles, setProfiles] = useState<ManagedProfile[]>([]);
  const [studies, setStudies] = useState<StudyDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ManagedProfile | null>(null);
  const [assignmentUser, setAssignmentUser] = useState<ManagedProfile | null>(null);
  const [assignment, setAssignment] = useState({ studyId: "", role: "enumerator", district: "", block: "", fpo: "", villages: "", sampleGroup: "both" });

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setStudies(await listStudies());
    if (auth.testMode) {
      setProfiles(testAccounts.map((account, index) => ({ id: `local-test-${account.role}`, display_name: account.displayName, email: account.email, role: account.role, requested_role: account.role, active: true, created_at: new Date().toISOString(), primary_mobile: "", organisation: "FieldFlow test workspace", designation: roleLabels[account.role], last_active: new Date().toISOString(), last_sync: null, surveys_completed: 0, assignments: index === 0 ? [] : [{ id: `test-assignment-${index}`, study_id: "00000000-0000-4000-8000-000000000001", study_name: "Uttarakhand Horticulture Baseline", role_in_study: account.role, active: true }] })));
      setMessage("Local test profiles are read-only. Install migration 0006 and use real Supabase accounts to test profile and assignment writes.");
      setLoading(false); return;
    }
    if (!client) { setLoading(false); return; }
    const fullColumns = "id, display_name, email, role, requested_role, active, created_at, profile_photo_url, gender, date_of_birth, primary_mobile, alternate_mobile, alternate_email, address_line_1, address_line_2, city, district, state, postal_code, country, organisation, department, designation, staff_id, username, last_login, last_active, last_sync";
    const full = await client.from("profiles").select(fullColumns).order("active", { ascending: false }).order("created_at", { ascending: false });
    const fallback = full.error ? await client.from("profiles").select("id, display_name, email, role, requested_role, active, created_at").order("created_at", { ascending: false }) : null;
    if (full.error && fallback?.error) { setMessage(full.error.message.includes("requested_role") ? "Apply migrations 0005 and 0006 to activate complete user management." : full.error.message); setProfiles([]); setLoading(false); return; }
    const base = (full.error ? fallback?.data ?? [] : full.data ?? []) as unknown as ManagedProfile[];
    const assignmentResult = await client.from("study_assignments").select("id, study_id, user_id, role_in_study, district, block, fpo, villages, active, studies(short_name)");
    const surveyResult = await client.from("survey_submissions").select("enumerator_id, status");
    setProfiles(base.map((profile) => ({ ...profile, surveys_completed: (surveyResult.data ?? []).filter((item) => item.enumerator_id === profile.id && ["submitted", "under_review", "approved"].includes(item.status)).length, assignments: assignmentResult.error ? [] : (assignmentResult.data ?? []).filter((item) => item.user_id === profile.id).map((item) => ({ id: item.id, study_id: item.study_id, study_name: relationName(item.studies), role_in_study: item.role_in_study, district: item.district, block: item.block, fpo: item.fpo, villages: Array.isArray(item.villages) ? item.villages as string[] : [], active: item.active })) })));
    setMessage(full.error ? "Basic accounts loaded. Apply migration 0006 to enable complete profiles and study assignments." : "");
    setLoading(false);
  }, [auth.testMode, client]);

  useEffect(() => { const timer = window.setTimeout(() => void loadProfiles(), 0); return () => window.clearTimeout(timer); }, [loadProfiles]);

  const updateAccount = async (profile: ManagedProfile, updates: Record<string, unknown>, success: string) => {
    if (!client || auth.testMode) return setMessage("Local test accounts are intentionally read-only.");
    setSavingId(profile.id); setMessage("");
    const { error } = await client.from("profiles").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", profile.id);
    setSavingId(null); if (error) return setMessage(error.message); setMessage(success); setEditing(null); await loadProfiles();
  };

  const saveAssignment = async () => {
    if (!client || !assignmentUser || auth.testMode) return setMessage("Use a real Administrator account to save study assignments.");
    const { error } = await client.from("study_assignments").insert({ study_id: assignment.studyId, user_id: assignmentUser.id, role_in_study: assignment.role, district: assignment.district || null, block: assignment.block || null, fpo: assignment.fpo || null, villages: assignment.villages.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean), sample_group: assignment.sampleGroup, active: true });
    if (error) return setMessage(error.message); setAssignmentUser(null); setMessage("Study assignment saved."); await loadProfiles();
  };

  const sendReset = async (profile: ManagedProfile) => {
    if (!client || !profile.email) return setMessage("This user does not have an email address.");
    const { error } = await client.auth.resetPasswordForEmail(profile.email, { redirectTo: `${window.location.origin}/login` });
    setMessage(error ? error.message : `Password-reset instructions were sent to ${profile.email}.`);
  };

  const validateBulkUsers = async (file?: File) => {
    if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
      const valid = rows.filter((row) => String(row.full_name ?? row.name).trim() && String(row.email).includes("@"));
      setMessage(`${valid.length} of ${rows.length} user rows passed basic validation. For security, each person must create or receive a Supabase Auth account before the profile can be activated; passwords are never imported from spreadsheets.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "User file could not be read."); }
  };

  const pending = profiles.filter((profile) => !profile.active).length;
  const fieldStaff = profiles.filter((profile) => profile.role === "enumerator" || profile.role === "supervisor").length;

  return <main className="admin-page user-admin-page">
    <header className="admin-topbar"><div><Link href="/">← Dashboard</Link><span>FieldFlow user administration</span></div><b>{pending} pending activation</b></header>
    <section className="admin-heading"><div><p>Professional profiles and assignments</p><h1>Users &amp; study access</h1><span>Maintain one account per person and assign it safely across multiple studies.</span></div><div className="user-heading-actions"><label className="bulk-user-import">Import users<input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => void validateBulkUsers(event.target.files?.[0])} /></label><Link href="/login">Create account</Link></div></section>
    {message && <div className="admin-notice">{message}</div>}
    <section className="user-kpis"><article><span>Total users</span><b>{profiles.length}</b></article><article><span>Active</span><b>{profiles.filter((profile) => profile.active).length}</b></article><article><span>Inactive</span><b>{profiles.filter((profile) => !profile.active).length}</b></article><article><span>Field staff</span><b>{fieldStaff}</b></article><article><span>Pending activation</span><b>{pending}</b></article></section>
    <section className="admin-panel account-panel complete-users"><header><div><p>Platform accounts</p><h2>{pending ? `${pending} account(s) require attention` : "All account requests reviewed"}</h2></div><button className="admin-add" onClick={() => void loadProfiles()}>Refresh</button></header>{loading ? <div className="admin-empty"><strong>Loading user profiles…</strong></div> : <div className="admin-table-wrap"><table className="account-table"><thead><tr><th>Person</th><th>Mobile / email</th><th>Platform role</th><th>Organisation</th><th>Assigned studies / area</th><th>Status</th><th>Activity</th><th>Surveys</th><th>Actions</th></tr></thead><tbody>{profiles.map((profile) => <tr key={profile.id} className={!profile.active ? "pending-account" : ""}><td><strong>{profile.display_name}</strong><small>@{profile.username || profile.email?.split("@")[0] || "username-pending"}</small><time>Created {new Date(profile.created_at).toLocaleDateString("en-IN")}</time></td><td><strong>{profile.primary_mobile || "Mobile pending"}</strong><small>{profile.email || "Email unavailable"}</small></td><td><select value={profile.role} disabled={savingId === profile.id || auth.testMode} onChange={(event) => void updateAccount(profile, { role: event.target.value, requested_role: event.target.value }, `${profile.display_name}'s platform role was updated.`)}>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td><td><strong>{profile.organisation || "Not recorded"}</strong><small>{profile.designation || profile.department || "Professional profile pending"}</small></td><td><div className="assignment-chips">{profile.assignments?.length ? profile.assignments.map((item) => <span key={item.id}><b>{item.study_name}</b><small>{item.role_in_study}{item.district ? ` · ${item.district}` : ""}</small></span>) : <em>No study assignment</em>}</div></td><td><span className={`account-status ${profile.active ? "active" : "pending"}`}>{profile.active ? "Active" : "Pending / inactive"}</span></td><td><small>Active: {formatDate(profile.last_active)}</small><small>Sync: {formatDate(profile.last_sync)}</small></td><td><strong>{profile.surveys_completed ?? 0}</strong></td><td><div className="user-row-actions"><button onClick={() => setEditing(profile)}>View / edit</button><button onClick={() => { setAssignmentUser(profile); setAssignment((current) => ({ ...current, studyId: studies[0]?.id ?? "" })); }}>Assign study</button><button onClick={() => void sendReset(profile)}>Reset password</button><button disabled={profile.id === auth.user?.id || auth.testMode} onClick={() => void updateAccount(profile, { active: !profile.active }, `${profile.display_name} was ${profile.active ? "deactivated" : "reactivated"}.`)}>{profile.active ? "Deactivate" : "Reactivate"}</button></div></td></tr>)}</tbody></table></div>}</section>

    {editing && <div className="user-editor-overlay" role="dialog" aria-modal="true"><section className="user-editor"><header><div><p>Complete professional profile</p><h2>{editing.display_name}</h2></div><button onClick={() => setEditing(null)}>×</button></header><div className="profile-form-grid">{profileFields.map((field) => <label key={field.key} className={field.wide ? "wide" : ""}>{field.label}<input type={field.type ?? "text"} value={String(editing[field.key] ?? "")} disabled={field.key === "email"} onChange={(event) => setEditing((current) => current ? { ...current, [field.key]: event.target.value } : current)} /></label>)}</div><footer><button onClick={() => setEditing(null)}>Cancel</button><button onClick={() => void updateAccount(editing, Object.fromEntries(profileFields.filter((field) => field.key !== "email").map((field) => [field.key, editing[field.key] || null])), `${editing.display_name}'s professional profile was saved.`)}>Save profile</button></footer></section></div>}

    {assignmentUser && <div className="user-editor-overlay" role="dialog" aria-modal="true"><section className="user-editor assignment-editor"><header><div><p>Multi-study access</p><h2>Assign {assignmentUser.display_name}</h2></div><button onClick={() => setAssignmentUser(null)}>×</button></header><div className="profile-form-grid"><label className="wide">Study<select value={assignment.studyId} onChange={(event) => setAssignment((current) => ({ ...current, studyId: event.target.value }))}>{studies.filter((study) => study.status !== "archived").map((study) => <option key={study.id} value={study.id}>{study.shortName}</option>)}</select></label><label>Role in study<select value={assignment.role} onChange={(event) => setAssignment((current) => ({ ...current, role: event.target.value }))}><option value="study_manager">Study manager</option><option value="supervisor">Supervisor</option><option value="reviewer">Reviewer</option><option value="enumerator">Enumerator</option></select></label><label>Sample group<select value={assignment.sampleGroup} onChange={(event) => setAssignment((current) => ({ ...current, sampleGroup: event.target.value }))}><option value="both">Both / not applicable</option><option value="treatment">Treatment</option><option value="control">Control</option></select></label><label>District<input value={assignment.district} onChange={(event) => setAssignment((current) => ({ ...current, district: event.target.value }))} /></label><label>Block<input value={assignment.block} onChange={(event) => setAssignment((current) => ({ ...current, block: event.target.value }))} /></label><label>FPO<input value={assignment.fpo} onChange={(event) => setAssignment((current) => ({ ...current, fpo: event.target.value }))} /></label><label className="wide">Villages (comma separated)<input value={assignment.villages} onChange={(event) => setAssignment((current) => ({ ...current, villages: event.target.value }))} /></label></div><footer><button onClick={() => setAssignmentUser(null)}>Cancel</button><button disabled={!assignment.studyId} onClick={() => void saveAssignment()}>Save assignment</button></footer></section></div>}
  </main>;
}

function relationName(value: unknown) { if (Array.isArray(value)) return String((value[0] as { short_name?: string } | undefined)?.short_name ?? "Assigned study"); if (value && typeof value === "object") return String((value as { short_name?: string }).short_name ?? "Assigned study"); return "Assigned study"; }
function formatDate(value?: string | null) { return value ? new Date(value).toLocaleDateString("en-IN") : "Not recorded"; }
