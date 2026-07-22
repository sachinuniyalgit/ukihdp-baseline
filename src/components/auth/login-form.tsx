"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    const client = getSupabaseBrowserClient();
    if (!client) return setMessage("Supabase is not configured. Add the project URL and public key first.");
    setSubmitting(true);
    setMessage("");
    const { error } = await client.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) return setMessage(error.message);
    router.replace("/");
  };

  if (auth.user) return <div className="login-card"><p className="login-kicker">Authenticated</p><h1>You are already signed in</h1><p>{auth.profile?.displayName ?? auth.user.email}</p><Link className="login-button" href="/">Open dashboard</Link></div>;

  return <form className="login-card" onSubmit={login}><p className="login-kicker">UKIHDP protected access</p><h1>Sign in to FieldFlow</h1><p>Use the account created by the project Administrator.</p>{auth.demoMode && <div className="login-warning"><strong>Local preview mode</strong><span>Authentication will activate after Supabase credentials are added.</span></div>}<label>Email address<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Password<input type="password" autoComplete="current-password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} /></label>{message && <div className="login-message">{message}</div>}<button className="login-button" disabled={submitting}>{submitting ? "Signing in..." : "Sign in"}</button><Link className="login-back" href="/">&larr; Return to dashboard</Link></form>;
}
