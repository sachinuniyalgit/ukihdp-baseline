"use client";

import { useEffect, useState } from "react";
import { BASELINE_STUDY_ID } from "@/config/studies";
import { SurveyForm } from "@/components/survey/survey-form";
import { GenericStudySurvey } from "@/components/survey/generic-study-survey";
import { getStudy } from "@/lib/studies/study-catalog";
import type { StudyDefinition } from "@/lib/studies/types";

export function SurveyEntry({ studyId }: { studyId?: string }) {
  const resolvedId = studyId || BASELINE_STUDY_ID;
  const [study, setStudy] = useState<StudyDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { const timer = window.setTimeout(() => void getStudy(resolvedId).then((item) => { setStudy(item ?? null); setLoading(false); }), 0); return () => window.clearTimeout(timer); }, [resolvedId]);
  if (loading) return <main className="survey-page"><div className="generic-survey-loading">Loading assigned study and questionnaire…</div></main>;
  if (!study) return <main className="survey-page"><div className="generic-survey-loading">The requested study is not available on this device.</div></main>;
  if (study.id === BASELINE_STUDY_ID || study.builtIn) return <SurveyForm />;
  if (!study.questionnaire || study.questionnaireStatus !== "published") return <main className="survey-page"><div className="generic-survey-loading">This study does not have a published questionnaire version.</div></main>;
  return <GenericStudySurvey study={study} />;
}
