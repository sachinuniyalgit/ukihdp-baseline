import { AccessGate } from "@/components/auth/access-gate";
import { CreateStudyWorkspace } from "@/components/studies/create-study-workspace";
import "../studies.css";

export default function NewStudyPage() { return <AccessGate roles={["admin", "researcher"]}><CreateStudyWorkspace /></AccessGate>; }
