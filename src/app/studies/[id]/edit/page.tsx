import { AccessGate } from "@/components/auth/access-gate";
import { EditStudyWorkspace } from "@/components/studies/edit-study-workspace";
import "../../studies.css";

export default async function EditStudyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AccessGate roles={["admin", "researcher"]}><EditStudyWorkspace studyId={id} /></AccessGate>;
}
