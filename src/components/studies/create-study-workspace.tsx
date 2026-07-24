"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { downloadQuestionnaireTemplate, downloadValidationReport, parseQuestionnaireFile } from "@/lib/studies/questionnaire-import";
import { saveStudy } from "@/lib/studies/study-catalog";
import { syncStudyToServer } from "@/lib/studies/study-sync";
import type { QuestionnaireImportResult, StudyDefinition, StudyStatus } from "@/lib/studies/types";

const initialForm = {
  code: "", fullName: "", shortName: "", description: "", studyType: "Baseline assessment", organisation: "", studyLead: "", contactPerson: "",
  startDate: "", endDate: "", status: "draft" as StudyStatus, geographicCoverage: "", targetSample: "", treatmentTarget: "", controlTarget: "",
};

export function CreateStudyWorkspace() {
  const router = useRouter();
  const auth = useAuth();
  const [form, setForm] = useState(initialForm);
  const [step, setStep] = useState(1);
  const [importResult, setImportResult] = useState<QuestionnaireImportResult | null>(null);
  const [parsing, setParsing] = useState(false);
  const [message, setMessage] = useState("");
  const criticalErrors = useMemo(() => importResult?.issues.filter((issue) => issue.severity === "error") ?? [], [importResult]);

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const importFile = async (file?: File) => {
    if (!file) return;
    setParsing(true); setMessage("");
    try { const result = await parseQuestionnaireFile(file); setImportResult(result); setStep(3); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Questionnaire could not be parsed."); }
    finally { setParsing(false); }
  };

  const publish = async () => {
    if (!importResult?.questionnaire || criticalErrors.length) return setMessage("Resolve all critical questionnaire validation errors before publishing.");
    const now = new Date().toISOString();
    const study: StudyDefinition = {
      id: crypto.randomUUID(), code: form.code.trim().toUpperCase(), fullName: form.fullName.trim(), shortName: form.shortName.trim(), description: form.description.trim(),
      studyType: form.studyType, organisation: form.organisation.trim(), studyLead: form.studyLead.trim(), contactPerson: form.contactPerson.trim(), startDate: form.startDate,
      endDate: form.endDate, status: form.status === "draft" ? "active" : form.status, geographicCoverage: form.geographicCoverage.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean),
      targetSample: Number(form.targetSample) || 0, treatmentTarget: form.treatmentTarget ? Number(form.treatmentTarget) : undefined, controlTarget: form.controlTarget ? Number(form.controlTarget) : undefined,
      questionnaireId: importResult.questionnaire.id, questionnaireVersion: importResult.questionnaire.version, questionnaireStatus: "published", questionnaire: { ...importResult.questionnaire, status: "published" },
      createdBy: auth.profile?.displayName ?? auth.user?.email ?? "Local administrator", createdAt: now, updatedAt: now,
    };
    try { await saveStudy(study); const central = auth.testMode ? { ok: false, message: "Local test mode" } : await syncStudyToServer(study); window.sessionStorage.setItem("fieldflow-study-publish-message", central.message); router.replace(`/studies/${study.id}`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Study could not be saved."); }
  };

  const studyReady = Boolean(form.code.trim() && form.fullName.trim() && form.shortName.trim() && form.organisation.trim());

  return <main className="platform-page">
    <header className="platform-topbar"><div><Link href="/studies">← Studies</Link><span>FieldFlow study administration</span></div><b>New study</b></header>
    <section className="platform-heading"><div><p>Reusable study builder</p><h1>Create a new study</h1><span>Import and validate a versioned questionnaire without modifying application source code.</span></div><button className="secondary-action" onClick={downloadQuestionnaireTemplate}>Download questionnaire template</button></section>
    <nav className="wizard-steps">{["Study information", "Upload questionnaire", "Validate & preview", "Publish & activate"].map((label, index) => <button key={label} className={step === index + 1 ? "active" : step > index + 1 ? "done" : ""} onClick={() => index + 1 < step && setStep(index + 1)}><span>{step > index + 1 ? "✓" : index + 1}</span>{label}</button>)}</nav>
    {message && <div className="platform-message error">{message}</div>}

    {step === 1 && <section className="builder-panel"><header><div><strong>Study information</strong><span>Fields marked * are required before questionnaire import.</span></div></header><div className="study-form-grid">
      <label>Study code *<input value={form.code} onChange={(event) => update("code", event.target.value)} placeholder="e.g. FFS-2026" /></label>
      <label>Short name *<input value={form.shortName} onChange={(event) => update("shortName", event.target.value)} /></label>
      <label className="wide">Full study name *<input value={form.fullName} onChange={(event) => update("fullName", event.target.value)} /></label>
      <label className="wide">Description<textarea value={form.description} onChange={(event) => update("description", event.target.value)} /></label>
      <label>Study type<select value={form.studyType} onChange={(event) => update("studyType", event.target.value)}><option>Baseline assessment</option><option>Monitoring survey</option><option>Evaluation</option><option>Research study</option><option>Needs assessment</option><option>Other</option></select></label>
      <label>Organisation *<input value={form.organisation} onChange={(event) => update("organisation", event.target.value)} /></label>
      <label>Study lead / PI<input value={form.studyLead} onChange={(event) => update("studyLead", event.target.value)} /></label>
      <label>Contact person<input value={form.contactPerson} onChange={(event) => update("contactPerson", event.target.value)} /></label>
      <label>Start date<input type="date" value={form.startDate} onChange={(event) => update("startDate", event.target.value)} /></label>
      <label>End date<input type="date" value={form.endDate} onChange={(event) => update("endDate", event.target.value)} /></label>
      <label>Target sample<input type="number" min="0" value={form.targetSample} onChange={(event) => update("targetSample", event.target.value)} /></label>
      <label>Geographic coverage<input value={form.geographicCoverage} onChange={(event) => update("geographicCoverage", event.target.value)} placeholder="Districts or regions, comma separated" /></label>
      <label>Treatment target (optional)<input type="number" min="0" value={form.treatmentTarget} onChange={(event) => update("treatmentTarget", event.target.value)} /></label>
      <label>Control target (optional)<input type="number" min="0" value={form.controlTarget} onChange={(event) => update("controlTarget", event.target.value)} /></label>
    </div><footer><button disabled={!studyReady} onClick={() => setStep(2)}>Continue to questionnaire →</button></footer></section>}

    {step === 2 && <section className="builder-panel upload-panel"><header><div><strong>Upload questionnaire</strong><span>XLSX is recommended. CSV supports a simple question list only.</span></div></header><label className="file-drop"><input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => void importFile(event.target.files?.[0])} /><span>⇧</span><strong>{parsing ? "Reading questionnaire…" : "Select XLSX or CSV questionnaire"}</strong><small>The file is parsed locally and is not published automatically.</small></label><footer><button className="secondary-action" onClick={() => setStep(1)}>Back</button></footer></section>}

    {step >= 3 && importResult && <section className="builder-panel validation-panel"><header><div><strong>Questionnaire validation</strong><span>{importResult.sourceFileName} · imported {new Date(importResult.importedAt).toLocaleString("en-IN")}</span></div><div className="validation-summary"><b className={criticalErrors.length ? "bad" : "good"}>{criticalErrors.length} errors</b><b>{importResult.issues.filter((issue) => issue.severity === "warning").length} warnings</b></div></header>
      <div className="import-stat-grid"><span><b>{importResult.statistics.sections}</b>Sections</span><span><b>{importResult.statistics.questions}</b>Questions</span><span><b>{importResult.statistics.options}</b>Options</span><span><b>{importResult.statistics.skipRules}</b>Skip rules</span><span><b>{importResult.statistics.calculations}</b>Calculations</span><span><b>{importResult.statistics.masterDataLinks}</b>Master links</span></div>
      {importResult.issues.length > 0 && <div className="validation-issues">{importResult.issues.map((issue, index) => <article key={`${issue.code}-${index}`} className={issue.severity}><b>{issue.severity}</b><div><strong>{issue.code}</strong><span>{issue.sheet}{issue.row ? ` · row ${issue.row}` : ""}</span><p>{issue.message}</p></div></article>)}</div>}
      {importResult.questionnaire && <div className="questionnaire-preview"><h2>Questionnaire preview</h2>{importResult.questionnaire.sections.map((section) => <details key={section.id} open><summary><span>{section.order}</span><strong>{section.title}</strong><small>{section.questions.length} questions</small></summary><div>{section.questions.map((question) => <article key={question.id}><code>{question.id}</code><p>{question.label}</p><span>{question.inputType}{question.required ? " · required" : ""}</span></article>)}</div></details>)}</div>}
      <footer><button className="secondary-action" onClick={() => setStep(2)}>Replace file</button>{importResult.issues.length > 0 && <button className="secondary-action" onClick={() => downloadValidationReport(importResult.issues)}>Download error report</button>}<button disabled={criticalErrors.length > 0} onClick={() => setStep(4)}>Continue to publish →</button></footer>
    </section>}

    {step === 4 && importResult?.questionnaire && <section className="builder-panel publish-panel"><header><div><strong>Publish questionnaire v1.0 and activate study</strong><span>Historical responses will remain linked to this exact questionnaire version.</span></div></header><div><span>Study</span><b>{form.fullName}</b><span>Questionnaire</span><b>{importResult.questionnaire.title}</b><span>Version</span><b>v1.0</b><span>Validation</span><b className="good">Passed</b></div><p>User assignments can be configured after the study is created. Enumerators will receive only published versions assigned to them.</p><footer><button className="secondary-action" onClick={() => setStep(3)}>Back to preview</button><button onClick={() => void publish()}>Publish and activate study</button></footer></section>}
  </main>;
}
