"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { AppRole } from "@/lib/survey/types";
import { testAccounts, type TestAccount } from "@/lib/test-accounts";

type AccessMode = "sign-in" | "sign-up";

const roleChoices: Array<{ role: AppRole; title: string; description: string; icon: string }> = [
  { role: "admin", title: "Administrator", description: "Manage users, master data and the complete study.", icon: "A" },
  { role: "reviewer", title: "Reviewer", description: "Verify submissions, return corrections and approve records.", icon: "R" },
  { role: "enumerator", title: "Enumerator", description: "Collect household and field data on mobile devices.", icon: "E" },
];

export function LoginForm() {
  const router = useRouter();
  const auth = useAuth();
  const [mode, setMode] = useState<AccessMode>("sign-in");
  const [requestedRole, setRequestedRole] = useState<AppRole>("enumerator");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"error" | "success">("error");
  const [submitting, setSubmitting] = useState(false);
  const [needsAdmin, setNeedsAdmin] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(isSupabaseConfigured);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    void client.rpc("needs_initial_admin").then(({ data, error }) => {
      if (!error && data === true) {
        setNeedsAdmin(true);
        if (!testAccounts.length) {
          setRequestedRole("admin");
          setMode("sign-up");
        }
      }
      setCheckingSetup(false);
    });
  }, []);

  const resetMessage = () => {
    setMessage("");
    setMessageTone("error");
  };

  const selectMode = (nextMode: AccessMode) => {
    if (needsAdmin && nextMode === "sign-up") setRequestedRole("admin");
    setMode(nextMode);
    resetMessage();
  };

  const authenticate = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    resetMessage();

    if (mode === "sign-in") {
      const testAccount = auth.signInForTesting(email, password);
      if (testAccount) {
        setSubmitting(false);
        router.replace("/");
        return;
      }
    }

    const client = getSupabaseBrowserClient();
    if (!client) {
      setSubmitting(false);
      return setMessage("Supabase is not configured. Use a local test account or add the project URL and publishable key.");
    }

    if (mode === "sign-up") {
      const role = needsAdmin ? "admin" : requestedRole;
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName.trim(), requested_role: role } },
      });
      if (error) {
        setSubmitting(false);
        return setMessage(error.message);
      }

      if (needsAdmin && data.session) {
        const { error: claimError } = await client.rpc("claim_initial_admin");
        setSubmitting(false);
        if (claimError) return setMessage(claimError.message);
        router.replace("/");
        return;
      }

      if (needsAdmin) {
        setMode("sign-in");
        setMessageTone("success");
        setMessage("Administrator account created. Confirm the email sent by Supabase, then sign in to finish activation.");
      } else {
        if (data.session) await client.auth.signOut();
        setMode("sign-in");
        setMessageTone("success");
        setMessage(`Your ${roleChoices.find((item) => item.role === role)?.title} access request was submitted. Sign in after an Administrator activates it.`);
      }
      setSubmitting(false);
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

  if (auth.user) {
    return <div className="login-card authenticated-card">
      <p className="login-kicker">Authenticated</p>
      <h1>You are already signed in</h1>
      <p>{auth.profile?.displayName ?? auth.user.email}</p>
      <Link className="login-button" href="/">Open dashboard</Link>
    </div>;
  }

  const isRegistration = mode === "sign-up";
  const heading = needsAdmin && isRegistration ? "Set up Administrator" : isRegistration ? "Request project access" : "Welcome back";

  const loginAsTestAccount = (account: TestAccount) => {
    resetMessage();
    setEmail(account.email);
    setPassword(account.password);
    const signedIn = auth.signInForTesting(account.email, account.password);
    if (signedIn) router.replace("/");
  };

  return <section className="login-card" aria-busy={submitting || checkingSetup}>
    <div className="login-mode-tabs" aria-label="Account access options">
      <button type="button" className={mode === "sign-in" ? "active" : ""} onClick={() => selectMode("sign-in")}>Sign in</button>
      <button type="button" className={mode === "sign-up" ? "active" : ""} onClick={() => selectMode("sign-up")}>{needsAdmin ? "Administrator setup" : "Create account"}</button>
    </div>

    <div className="login-card-heading">
      <p className="login-kicker">UKIHDP protected access</p>
      <h1>{heading}</h1>
      <p>{needsAdmin && isRegistration
        ? "Create the first project-owner account. You choose its password now; no public default password is used."
        : isRegistration
          ? "Select the role you need. An Administrator will review and activate your account."
          : "Sign in with your approved UKIHDP project account."}</p>
    </div>

    {auth.demoMode && <div className="login-warning"><strong>Local preview mode</strong><span>Authentication will activate after Supabase credentials are added.</span></div>}

    {!isRegistration && testAccounts.length > 0 && <div className="test-account-panel">
      <div className="test-account-heading"><div><strong>Quick test accounts</strong><span>Choose a role to open its local dashboard.</span></div><b>LOCAL ONLY</b></div>
      <div className="test-account-list">
        {testAccounts.map((account) => <button type="button" key={account.role} onClick={() => loginAsTestAccount(account)}>
          <span className={`test-role ${account.role}`}>{account.role === "admin" ? "A" : account.role === "reviewer" ? "R" : "E"}</span>
          <div><strong>{account.displayName}</strong><small>{account.email}</small><code>{account.password}</code></div>
          <i>Open</i>
        </button>)}
      </div>
      <p>These accounts are for visual testing only. They cannot read or change production survey data.</p>
    </div>}

    {isRegistration && <div className="role-picker" aria-label="Requested account role">
      {roleChoices.map((choice) => {
        const disabled = needsAdmin && choice.role !== "admin";
        return <button
          type="button"
          key={choice.role}
          className={requestedRole === choice.role ? "selected" : ""}
          disabled={disabled}
          onClick={() => { setRequestedRole(choice.role); resetMessage(); }}
        >
          <span>{choice.icon}</span>
          <div><strong>{choice.title}</strong><small>{choice.description}</small></div>
          <i aria-hidden>{requestedRole === choice.role ? "✓" : ""}</i>
        </button>;
      })}
    </div>}

    <form className="login-fields" onSubmit={authenticate}>
      {isRegistration && <label>Full name<input type="text" autoComplete="name" required value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Enter your name" /></label>}
      <label>Email address<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.org" /></label>
      <label>Password<input type="password" autoComplete={isRegistration ? "new-password" : "current-password"} required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isRegistration ? "Create at least 8 characters" : "Enter your password"} /></label>
      {isRegistration && <p className="password-note">Use at least 8 characters. Do not reuse the Supabase database password.</p>}
      {message && <div className={`login-message ${messageTone}`}>{message}</div>}
      <button className="login-button" disabled={submitting || checkingSetup}>{submitting ? "Please wait..." : isRegistration ? needsAdmin ? "Create Administrator" : `Request ${roleChoices.find((item) => item.role === requestedRole)?.title} access` : "Sign in securely"}</button>
    </form>

    <div className="login-help">
      <span>{isRegistration ? "Already registered?" : "Need a project account?"}</span>
      <button type="button" onClick={() => selectMode(isRegistration ? "sign-in" : "sign-up")}>{isRegistration ? "Sign in" : needsAdmin ? "Set up Administrator" : "Create account"}</button>
    </div>
    <Link className="login-back" href="/">← Return to dashboard</Link>
  </section>;
}
