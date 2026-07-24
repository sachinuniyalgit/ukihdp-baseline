"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import type { AppRole } from "@/lib/survey/types";

export function AccessGate({ children, roles }: { children: React.ReactNode; roles?: AppRole[] }) {
  const auth = useAuth();
  if (auth.demoMode) return <>{children}</>;
  if (auth.loading) return <GateMessage title="Checking secure access" text="Please wait while your session and project role are verified." />;
  if (!auth.user) return <GateMessage title="Sign in required" text="This workspace contains protected research data." action={<Link href="/login">Open secure login</Link>} />;
  if (!auth.profile?.active) return <GateMessage title="Account awaiting activation" text="An Administrator must activate your project profile before you can continue." />;
  if (roles && (!auth.profile || !roles.includes(auth.profile.role))) return <GateMessage title="Access restricted" text="Your assigned project role does not permit access to this workspace." action={<Link href="/">Return to dashboard</Link>} />;
  return <>{children}</>;
}

function GateMessage({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return <main className="access-gate"><section><span>FieldFlow secure workspace</span><h1>{title}</h1><p>{text}</p>{action}</section></main>;
}
