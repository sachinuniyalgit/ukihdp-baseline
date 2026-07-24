import { SurveyEntry } from "@/components/survey/survey-entry";
import { AccessGate } from "@/components/auth/access-gate";

export default async function NewSurveyPage({ searchParams }: { searchParams: Promise<{ study?: string }> }) {
  const { study } = await searchParams;
  return <AccessGate roles={["enumerator", "researcher", "admin"]}><SurveyEntry studyId={study} /></AccessGate>;
}
