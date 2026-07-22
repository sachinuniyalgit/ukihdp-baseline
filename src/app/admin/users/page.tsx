import { UserManagementPanel } from "@/components/admin/user-management-panel";
import { AccessGate } from "@/components/auth/access-gate";

export default function UserManagementPage() {
  return <AccessGate roles={["admin"]}><UserManagementPanel /></AccessGate>;
}
