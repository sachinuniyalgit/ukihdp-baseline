"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [needsAdmin, setNeedsAdmin] = useState(false);
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    void client.rpc("needs_initial_admin").then(({ data, error }) => {
      if (!error && data === true) {
        setNeedsAdmin(true);
        setCreatingAdmin(true);
      }
    });
  }, []);

  const authenticate = async (event: React.FormEvent) => {
    event.preventDefault();
    const client = getSupabaseBrowserClient();
    if (!client) return setMessage("Supabase is not configured. Add the project URL and publishable key first.");
    setSubmitting(true);
    setMessage("");

    if (creatingAdmin && needsAdmin) {
      const { data, error } = await client.auth.signUp({ email, password, options: { data: { display_name: displayName.trim() } } });
      if (error) {
        setSubmitting(false);
        return setMessage(error.message);
      }
      if (!data.session) {
        setSubmitting(false);
        setCreatingAdmin(false);
        return setMessage("Account created. Confirm the email sent by Supabase, then return here and sign in to activate the first Administrator.");
      }
      const { error: claimError } = await client.rpc("claim_initial_admin");
      setSubmitting(false);
      if (claimError) return setMessage(claimError.message);
      router.replace("/");
      return;
    }

    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      setSubmitting(false);
      return setMessage(error.message);
    }
    const { data: initialAdminRequired } = await client.rpc("needs_initial_admin");
    if (initialAdminRequired === true) {
      const { error: claimError } = await client.rpc("claim_initial_admin");
      if (claimError) {
        setSubmitting(false);
        return setMessage(claimError.message);
      }
    }
    setSubmitting(false);
    router.replace("/");
  };

  if (auth.user) return <div className="login-card"><p className="login-kicker">Authenticated</p><h1>You are already signed in</h1><p>{auth.profile?.displayName ?? auth.user.email}</p><Link className="login-button" href="/">Open dashboard</Link></div>;

  return <form className="login-card" onSubmit={authenticate}>
    <p className="login-kicker">UKIHDP protected access</p>
    <h1>{creatingAdmin ? "Create first Administrator" : "Sign in to FieldFlow"}</h1>
    <p>{creatingAdmin ? "Create the protected project-owner account. This option permanently closes after the first Administrator is assigned." : "Use the account created by the project Administrator."}</p>
    {auth.demoMode && <div className="login-warning"><strong>Local preview mode</strong><span>Authentication will activate after Supabase credentials are added.</span></div>}
    {creatingAdmin && <label>Display name<input type="text" autoComplete="name" required value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>}
    <label>Email address<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
    <label>Password<input type="password" autoComplete={creatingAdmin ? "new-password" : "current-password"} required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    {message && <div className="login-message">{message}</div>}
    <button className="login-button" disabled={submitting}>{submitting ? "Please wait..." : creatingAdmin ? "Create Administrator" : "Sign in"}</button>
    {needsAdmin && <button type="button" className="login-switch" onClick={() => { setCreatingAdmin((value) => !value); setMessage(""); }}>{creatingAdmin ? "I already created an account — sign in" : "Create the first Administrator"}</button>}
    <Link className="login-back" href="/">&larr; Return to dashboard</Link>
  </form>;
}
