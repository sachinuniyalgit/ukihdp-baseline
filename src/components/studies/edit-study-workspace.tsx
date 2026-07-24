"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { parseQuestionnaireFile } from "@/lib/studies/questionnaire-import";
import { getStudy, saveStudy } from "@/lib/studies/study-catalog";
import { syncStudyToServer } from "@/lib/studies/study-sync";
import type { QuestionnaireImportResult, StudyDefinition, StudyStatus } from "@/lib/studies/types";

export function EditStudyWorkspace({ studyId }: { studyId: string }) {
  const auth = useAuth();
  const router = useRouter();
  const [study, setStudy] = useState<StudyDefinition | null>(null);
  const [message, setMessage] = useState("");
  const [importResult, setImportResult] = useState<QuestionnaireImportResult | null>(null);
  const [version, setVersion] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { void getStudy(studyId).then((item) => { if (item) { setStudy(item); setVersion(nextVersion(item.questionnaireVersion)); } }); }, [studyId]);
  const errors = useMemo(() => importResult?.issues.filter((issue) => issue.severity === "error") ?? [], [importResult]);
  if (!study) return <main className="platform-page"><div className="platform-empty">Loading study configuration…</div></main>;
  if (study.builtIn) return <main className="platform-page"><div className="platform-empty"><strong>The built-in UKIHDP questionnaire is protected.</strong><Link href={`/studies/${study.id}`}>Return to study</Link></div></main>;

  const update = <K extends keyof StudyDefinition>(key: K, value: StudyDefinition[K]) => setStudy((current) => current ? { ...current, [key]: value } : current);
  async function chooseQuestionnaire(file?: File) {
    if (!file) return;
    try { setImportResult(await parseQuestionnaireFile(file)); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Questionnaire could not be read."); }
  }
  async function save() {
    const currentStudy = study;
    if (!currentStudy) return;
    if (!currentStudy.fullName.trim() || !currentStudy.shortName.trim() || !currentStudy.organisation.trim()) return setMessage("Full name, short name, and organisation are required.");
    if (importResult && (!importResult.questionnaire || errors.length)) return setMessage("Resolve questionnaire validation errors before publishing a new version.");
    setSaving(true);
    try {
      const questionnaire = importResult?.questionnaire ? { ...importResult.questionnaire, version: version.trim(), status: "published" as const } : currentStudy.questionnaire;
      const updated: StudyDefinition = { ...currentStudy, code: currentStudy.code.trim().toUpperCase(), geographicCoverage: currentStudy.geographicCoverage.filter(Boolean), questionnaire, questionnaireId: questionnaire?.id ?? currentStudy.questionnaireId, questionnaireVersion: questionnaire?.version ?? currentStudy.questionnaireVersion, questionnaireStatus: questionnaire ? "published" : currentStudy.questionnaireStatus, updatedAt: new Date().toISOString() };
      await saveStudy(updated);
      const result = auth.testMode ? { message: "Changes saved to this local test workspace." } : await syncStudyToServer(updated);
      window.sessionStorage.setItem("fieldflow-study-publish-message", result.message);
      router.push(`/studies/${updated.id}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Study changes could not be saved."); }
    finally { setSaving(false); }
  }

  return <main className="platform-page">
    <header className="platform-topbar"><div><Link href={`/studies/${study.id}`}>← Study workspace</Link><span>Study configuration</span></div><b>{study.code}</b></header>
    <section className="platform-heading"><div><p>Version-controlled administration</p><h1>Edit study and questionnaire</h1><span>Metadata can be updated; imported questionnaires are published as a new version without deleting historical responses.</span></div></section>
    {message && <div className="platform-message error">{message}</div>}
    <section className="builder-panel"><header><div><strong>Study information</strong><span>Changes apply only to this study.</span></div></header><div className="study-form-grid">
      <label>Study code<input value={study.code} onChange={(event) => update("code", event.target.value)} /></label><label>Short name<input value={study.shortName} onChange={(event) => update("shortName", event.target.value)} /></label>
      <label className="wide">Full study name<input value={study.fullName} onChange={(event) => update("fullName", event.target.value)} /></label><label className="wide">Description<textarea value={study.description} onChange={(event) => update("description", event.target.value)} /></label>
      <label>Organisation<input value={study.organisation} onChange={(event) => update("organisation", event.target.value)} /></label><label>Study status<select value={study.status} onChange={(event) => update("status", event.target.value as StudyStatus)}><option value="draft">Draft</option><option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option><option value="archived">Archived</option></select></label>
      <label>Study lead / PI<input value={study.studyLead} onChange={(event) => update("studyLead", event.target.value)} /></label><label>Contact person<input value={study.contactPerson} onChange={(event) => update("contactPerson", event.target.value)} /></label>
      <label>Start date<input type="date" value={study.startDate} onChange={(event) => update("startDate", event.target.value)} /></label><label>End date<input type="date" value={study.endDate} onChange={(event) => update("endDate", event.target.value)} /></label>
      <label>Target sample<input type="number" min="0" value={study.targetSample} onChange={(event) => update("targetSample", Number(event.target.value))} /></label><label>Geographic coverage<input value={study.geographicCoverage.join(", ")} onChange={(event) => update("geographicCoverage", event.target.value.split(/[,;\n]/).map((item) => item.trim()))} /></label>
    </div></section>
    <section className="builder-panel edit-questionnaire-panel"><header><div><strong>Questionnaire version</strong><span>Current published version: {study.questionnaireVersion}</span></div></header><div className="study-form-grid"><label>New version<input value={version} onChange={(event) => setVersion(event.target.value)} placeholder="1.1" /></label><label>Import replacement XLSX or CSV<input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => void chooseQuestionnaire(event.target.files?.[0])} /></label></div>
      {importResult && <div className="import-stat-grid"><span><b>{importResult.statistics.sections}</b>Sections</span><span><b>{importResult.statistics.questions}</b>Questions</span><span><b>{importResult.statistics.masterDataLinks}</b>Master links</span><span><b>{errors.length}</b>Errors</span><span><b>{importResult.issues.length - errors.length}</b>Warnings</span></div>}
      <footer><Link className="secondary-action" href={`/studies/${study.id}`}>Cancel</Link><button disabled={saving || Boolean(importResult && errors.length) || Boolean(importResult && !version.trim())} onClick={() => void save()}>{saving ? "Saving…" : importResult ? "Publish new version" : "Save study"}</button></footer>
    </section>
  </main>;
}

function nextVersion(value: string) { const match = value.match(/(\d+)\.(\d+)/); return match ? `${match[1]}.${Number(match[2]) + 1}` : "1.1"; }
