import { AccessGate } from "@/components/auth/access-gate";
import { RoleDashboard } from "@/components/dashboard/role-dashboard";
import "./dashboard.css";

export default function Home() {
  return <AccessGate><RoleDashboard /></AccessGate>;
}
