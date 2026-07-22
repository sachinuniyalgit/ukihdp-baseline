"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AppRole } from "@/lib/survey/types";

interface ManagedProfile {
  id: string;
  display_name: string;
  email: string | null;
  role: AppRole;
  requested_role: AppRole | null;
  active: boolean;
  created_at: string;
}

const roleLabels: Record<AppRole, string> = {
  admin: "Administrator",
  reviewer: "Reviewer",
  enumerator: "Enumerator",
};

export function UserManagementPanel() {
  const auth = useAuth();
  const client = useMemo(() => getSupabaseBrowserClient(), []);
  const [profiles, setProfiles] = useState<ManagedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    const { data, error } = await client
      .from("profiles")
      .select("id, display_name, email, role, requested_role, active, created_at")
      .order("active", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) setMessage(error.message.includes("requested_role") ? "Account approval database update is not installed yet. Apply migration 0005." : error.message);
    else {
      setProfiles((data ?? []) as ManagedProfile[]);
      setMessage("");
    }
    setLoading(false);
  }, [client]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadProfiles(), 0);
    return () => window.clearTimeout(timer);
  }, [loadProfiles]);

  const updateAccount = async (profile: ManagedProfile, updates: Partial<Pick<ManagedProfile, "role" | "active" | "requested_role">>) => {
    if (!client) return;
    setSavingId(profile.id);
    setMessage("");
    const { error } = await client.from("profiles").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", profile.id);
    setSavingId(null);
    if (error) return setMessage(error.message);
    setMessage(`${profile.display_name}'s account was updated.`);
    await loadProfiles();
  };

  const pendingCount = profiles.filter((profile) => !profile.active).length;

  return <main className="admin-page">
    <header className="admin-topbar"><div><Link href="/">← Dashboard</Link><span>UKIHDP account administration</span></div><b>{pendingCount} pending</b></header>
    <section className="admin-heading">
      <div><p>Secure access control</p><h1>Users & roles</h1><span>Approve new account requests and assign the correct project role.</span></div>
      <div className="admin-security"><strong>No shared default password</strong><span>Every person creates a private password. Administrators approve role and access separately.</span></div>
    </section>

    {message && <div className="admin-notice">{message}</div>}

    <section className="admin-panel account-panel">
      <header><div><p>Account requests</p><h2>{pendingCount ? `${pendingCount} awaiting activation` : "All requests reviewed"}</h2></div><button className="admin-add" onClick={() => void loadProfiles()}>Refresh</button></header>
      {loading ? <div className="admin-empty"><strong>Loading accounts…</strong></div> : profiles.length === 0 ? <div className="admin-empty"><strong>No user accounts found</strong><p>New registrations will appear here for approval.</p></div> : <div className="admin-table-wrap">
        <table className="account-table">
          <thead><tr><th>Person</th><th>Requested role</th><th>Assigned role</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>{profiles.map((profile) => {
            const ownAccount = profile.id === auth.user?.id;
            const requestedRole = profile.requested_role ?? profile.role;
            return <tr key={profile.id} className={!profile.active ? "pending-account" : ""}>
              <td><strong>{profile.display_name}</strong><small>{profile.email ?? "Email unavailable"}</small><time>{new Date(profile.created_at).toLocaleDateString("en-IN")}</time></td>
              <td><span className={`role-badge ${requestedRole}`}>{roleLabels[requestedRole]}</span></td>
              <td><select aria-label={`Assigned role for ${profile.display_name}`} value={profile.role} disabled={savingId === profile.id} onChange={(event) => void updateAccount(profile, { role: event.target.value as AppRole, requested_role: event.target.value as AppRole })}><option value="admin">Administrator</option><option value="reviewer">Reviewer</option><option value="enumerator">Enumerator</option></select></td>
              <td><span className={`account-status ${profile.active ? "active" : "pending"}`}>{profile.active ? "Active" : "Pending approval"}</span></td>
              <td>{profile.active
                ? <button className="account-action secondary" disabled={ownAccount || savingId === profile.id} onClick={() => void updateAccount(profile, { active: false })}>{ownAccount ? "Current account" : "Deactivate"}</button>
                : <button className="account-action" disabled={savingId === profile.id} onClick={() => void updateAccount(profile, { role: requestedRole, requested_role: requestedRole, active: true })}>{savingId === profile.id ? "Saving…" : "Approve access"}</button>}
              </td>
            </tr>;
          })}</tbody>
        </table>
      </div>}
    </section>
  </main>;
}
