import { SurveyForm } from "@/components/survey/survey-form";
import { AccessGate } from "@/components/auth/access-gate";

export default function NewSurveyPage() {
  return <AccessGate roles={["enumerator", "reviewer", "admin"]}><SurveyForm /></AccessGate>;
}
