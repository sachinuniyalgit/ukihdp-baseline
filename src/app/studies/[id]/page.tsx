import { AccessGate } from "@/components/auth/access-gate";
import { StudyCommandCentre } from "@/components/studies/study-command-centre";
import "../studies.css";

export default async function StudyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AccessGate><StudyCommandCentre studyId={id} /></AccessGate>;
}
