import { MasterDataPanel } from "@/components/admin/master-data-panel";
import { AccessGate } from "@/components/auth/access-gate";

export default function MasterDataPage() {
  return <AccessGate roles={["admin"]}><MasterDataPanel /></AccessGate>;
}
