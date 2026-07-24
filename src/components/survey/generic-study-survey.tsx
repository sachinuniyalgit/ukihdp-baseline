"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { getSurveyDraft, queueSurveyForSync, saveSurveyDraft } from "@/lib/offline-drafts";
import { syncSurveyDraftById } from "@/lib/survey-sync";
import type { StudyDefinition } from "@/lib/studies/types";
import type { AnswerValue, QuestionDefinition, VisibilityRule } from "@/lib/survey/types";

type Answers = Record<string, AnswerValue>;

function subscribe(callback: () => void) { window.addEventListener("online", callback); window.addEventListener("offline", callback); return () => { window.removeEventListener("online", callback); window.removeEventListener("offline", callback); }; }
const hasValue = (value: unknown) => value !== null && value !== undefined && value !== "" && (!Array.isArray(value) || value.length > 0);

export function GenericStudySurvey({ study }: { study: StudyDefinition }) {
  const questionnaire = study.questionnaire!;
  const [answers, setAnswers] = useState<Answers>({});
  const [sectionIndex, setSectionIndex] = useState(0);
  const [draftId, setDraftId] = useState(() => `${study.code}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [notice, setNotice] = useState("");
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  const section = questionnaire.sections[sectionIndex];

  useEffect(() => {
    const requestedId = new URLSearchParams(window.location.search).get("draft");
    if (!requestedId) return;
    void getSurveyDraft(requestedId).then((draft) => {
      if (!draft || draft.studyId !== study.id) return;
      setDraftId(draft.id);
      setAnswers((draft.sectionData.answers ?? {}) as Answers);
      setNotice("Local study draft restored from this device.");
    });
  }, [study.id]);

  useEffect(() => {
    if (!Object.keys(answers).length) return;
    const timer = window.setTimeout(() => {
      void saveSurveyDraft({
        id: draftId, studyId: study.id, studyCode: study.code, studyName: study.shortName, questionnaireId: questionnaire.id, questionnaireVersion: questionnaire.version,
        status: "draft", syncState: "saved_locally", updatedAt: new Date().toISOString(), sectionData: { answers: answers as Record<string, unknown> },
      }).then(() => setSaveState("saved")).catch(() => setSaveState("error"));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [answers, draftId, questionnaire.id, questionnaire.version, study.code, study.id, study.shortName]);

  const visibleQuestions = useMemo(() => section.questions.filter((question) => visible(question.showWhen, answers)), [answers, section.questions]);
  const missing = visibleQuestions.filter((question) => question.required && !hasValue(answers[question.id]));
  const update = (id: string, value: AnswerValue) => {
    setSaveState("saving");
    setAnswers((current) => ({ ...current, [id]: value }));
  };

  const submit = async () => {
    const allRequired = questionnaire.sections.flatMap((item) => item.questions).filter((question) => question.required && visible(question.showWhen, answers));
    const allMissing = allRequired.filter((question) => !hasValue(answers[question.id]));
    if (allMissing.length) { setNotice(`${allMissing.length} required response(s) are incomplete. Review the highlighted questions.`); return; }
    await saveSurveyDraft({ id: draftId, studyId: study.id, studyCode: study.code, studyName: study.shortName, questionnaireId: questionnaire.id, questionnaireVersion: questionnaire.version, status: "draft", syncState: "saved_locally", updatedAt: new Date().toISOString(), sectionData: { answers: answers as Record<string, unknown> } });
    await queueSurveyForSync(draftId);
    if (online) {
      const result = await syncSurveyDraftById(draftId);
      setNotice(result.ok ? "Survey synchronized and sent for review." : `${result.message} The complete local copy has been retained.`);
    } else setNotice("Survey completed and queued safely. It will synchronize when internet access returns.");
  };

  return <main className="survey-page generic-survey">
    <header className="generic-survey-top"><div><Link href={`/studies/${study.id}`}>← Study workspace</Link><span>{study.code} · {questionnaire.version}</span></div><div><b className={online ? "online" : "offline"}>{online ? "Online" : "Offline"}</b><span className={`save-state ${saveState}`}>{saveState === "saved" ? "Saved locally" : saveState === "saving" ? "Saving…" : "Save failed"}</span></div></header>
    <section className="generic-survey-title"><p>FieldFlow versioned questionnaire</p><h1>{questionnaire.title}</h1><span>{study.shortName} · Survey ID {draftId}</span></section>
    {notice && <div className="generic-notice">{notice}<button onClick={() => setNotice("")}>×</button></div>}
    <section className="generic-survey-layout"><aside><strong>Questionnaire sections</strong>{questionnaire.sections.map((item, index) => <button key={item.id} className={index === sectionIndex ? "active" : ""} onClick={() => setSectionIndex(index)}><span>{index + 1}</span><div><b>{item.shortTitle}</b><small>{item.questions.length} questions</small></div></button>)}</aside>
      <article className="generic-question-panel"><header><div><p>Section {sectionIndex + 1} of {questionnaire.sections.length}</p><h2>{section.title}</h2><span>{section.description}</span></div><b>{missing.length ? `${missing.length} required` : "Section complete"}</b></header><div className="generic-question-list">{visibleQuestions.map((question) => <GenericQuestion key={question.id} question={question} value={answers[question.id]} answers={answers} onChange={(value) => update(question.id, value)} />)}</div><footer><button disabled={sectionIndex === 0} onClick={() => setSectionIndex((index) => index - 1)}>← Previous</button>{sectionIndex < questionnaire.sections.length - 1 ? <button onClick={() => setSectionIndex((index) => index + 1)}>Next section →</button> : <button className="submit" onClick={() => void submit()}>Complete and queue for sync</button>}</footer></article>
    </section>
  </main>;
}

function GenericQuestion({ question, value, answers, onChange }: { question: QuestionDefinition; value: AnswerValue | undefined; answers: Answers; onChange: (value: AnswerValue) => void }) {
  const [gpsState, setGpsState] = useState("");
  const common = { id: `generic-${question.id}`, required: question.required };
  const automatic = question.inputType === "automatic" || question.inputType === "readonly" ? calculate(question, answers) : "";
  const selectedValues = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  const file = (selected?: File) => {
    if (!selected) return;
    const reader = new FileReader();
    reader.onload = () => onChange({ name: selected.name, type: selected.type, size: selected.size, dataUrl: String(reader.result) });
    reader.readAsDataURL(selected);
  };
  const captureGps = () => {
    if (!navigator.geolocation) return setGpsState("GPS is not available on this device.");
    setGpsState("Capturing location…");
    navigator.geolocation.getCurrentPosition((position) => { onChange({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, capturedAt: new Date().toISOString() }); setGpsState(`Captured within ${Math.round(position.coords.accuracy)} m`); }, (error) => setGpsState(error.message), { enableHighAccuracy: true, timeout: 20000 });
  };

  return <section className={`generic-question ${question.required && !hasValue(value) ? "required-missing" : ""}`}><header><label htmlFor={common.id}>{question.label}{question.required && <em>*</em>}</label><code>{question.id}</code></header>{question.helpText && <p>{question.helpText}</p>}{question.recallPeriod && <small>Reference period: {question.recallPeriod}</small>}
    {question.inputType === "text" && <input {...common} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} />}
    {question.inputType === "textarea" && <textarea {...common} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} />}
    {["number", "decimal", "currency", "year"].includes(question.inputType) && <div className="number-with-unit"><input {...common} type="number" step={question.inputType === "number" || question.inputType === "year" ? "1" : "any"} value={typeof value === "number" || typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))} /><span>{question.unit}</span></div>}
    {["date", "time", "datetime"].includes(question.inputType) && <input {...common} type={question.inputType === "datetime" ? "datetime-local" : question.inputType} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} />}
    {["radio", "select", "search_select"].includes(question.inputType) && (question.inputType === "radio" ? <div className="choice-grid">{question.options?.map((option) => <button type="button" key={option} className={value === option ? "selected" : ""} onClick={() => onChange(option)}>{option}</button>)}</div> : <select {...common} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}><option value="">Select…</option>{question.options?.map((option) => <option key={option}>{option}</option>)}</select>)}
    {question.inputType === "multiselect" && <div className="choice-grid multi">{question.options?.map((option) => { const selected = selectedValues.includes(option); return <button type="button" key={option} className={selected ? "selected" : ""} onClick={() => onChange(selected ? selectedValues.filter((item) => item !== option) : [...selectedValues, option])}>{selected ? "✓ " : ""}{option}</button>; })}</div>}
    {question.inputType === "gps" && <div className="gps-entry"><button type="button" onClick={captureGps}>⌖ Capture device GPS</button><span>{gpsState || (value && typeof value === "object" && !Array.isArray(value) ? `${Number((value as Record<string, unknown>).latitude).toFixed(5)}, ${Number((value as Record<string, unknown>).longitude).toFixed(5)}` : "Not captured")}</span></div>}
    {["photo", "file", "signature"].includes(question.inputType) && <div className="file-entry"><input {...common} type="file" accept={question.inputType === "photo" || question.inputType === "signature" ? "image/*" : undefined} capture={question.inputType === "photo" ? "environment" : undefined} onChange={(event) => file(event.target.files?.[0])} /><span>{value && typeof value === "object" && !Array.isArray(value) ? String((value as Record<string, unknown>).name ?? "Stored locally") : "No file selected"}</span></div>}
    {(question.inputType === "automatic" || question.inputType === "readonly") && <output>{automatic}</output>}
    {question.inputType === "matrix" && <textarea {...common} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} placeholder="Enter matrix response or notes" />}
    {question.inputType === "repeat_group" && <RepeatGroup value={Array.isArray(value) ? value as Array<Record<string, unknown>> : []} onChange={onChange} />}
  </section>;
}

function RepeatGroup({ value, onChange }: { value: Array<Record<string, unknown>>; onChange: (value: AnswerValue) => void }) {
  return <div className="generic-repeat"><div>{value.map((row, index) => <article key={index}><input value={String(row.value ?? "")} onChange={(event) => onChange(value.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))} placeholder={`Entry ${index + 1}`} /><button type="button" onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></article>)}</div><button type="button" onClick={() => onChange([...value, { value: "" }])}>＋ Add entry</button></div>;
}

function visible(rules: VisibilityRule | VisibilityRule[] | undefined, answers: Answers) {
  if (!rules) return true;
  return (Array.isArray(rules) ? rules : [rules]).every((rule) => {
    const actual = answers[rule.questionId];
    if (rule.operator === "not_empty") return hasValue(actual);
    if (rule.operator === "not_equals") return actual !== rule.value;
    if (rule.operator === "includes") return Array.isArray(actual) && actual.includes(rule.value as never);
    return actual === rule.value;
  });
}

function calculate(question: QuestionDefinition, answers: Answers) {
  if (!question.dependsOn?.length) return question.helpText || "Calculated automatically";
  const total = question.dependsOn.reduce((sum, id) => sum + Number(answers[id] ?? 0), 0);
  return `${question.unit ? `${question.unit} ` : ""}${Number.isFinite(total) ? total.toLocaleString("en-IN") : "—"}`;
}
