"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";
import { householdQuestionnaire, institutionalQuestionnaire } from "@/config/questionnaires";
import { blocksForDistrict, findFpo, fposForLocation, projectFpos, projectMaster } from "@/config/project-master";
import { queueSurveyForSync, saveSurveyDraft } from "@/lib/offline-drafts";
import type { AnswerValue, QuestionnaireDefinition, QuestionDefinition, VisibilityRule } from "@/lib/survey/types";

type AnswerMap = Record<string, AnswerValue>;
type Instrument = "household" | "institutional";

const hasValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return true;
};

const numberValue = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  if (value && typeof value === "object" && "value" in value) return Number((value as { value?: unknown }).value) || 0;
  return 0;
};

const sumNumbers = (value: unknown): number => {
  if (Array.isArray(value)) return value.reduce((total, item) => total + sumNumbers(item), 0);
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).reduce<number>((total, item) => total + sumNumbers(item), 0);
  return numberValue(value);
};

function countConfiguredFields(questionnaire: QuestionnaireDefinition) {
  return questionnaire.sections.reduce(
    (total, item) => total + item.questions.reduce((sectionTotal, question) => sectionTotal + 1 + (question.fields?.length ?? 0), 0),
    0,
  );
}

function findQuestion(questionnaire: QuestionnaireDefinition, id: string): QuestionDefinition | undefined {
  for (const item of questionnaire.sections) {
    for (const question of item.questions) {
      if (question.id === id) return question;
      const nested = question.fields?.find((field) => field.id === id);
      if (nested) return nested;
    }
  }
  return undefined;
}

function makeDraftId(instrument: Instrument, suffix: string) {
  const prefix = instrument === "household" ? "HH" : "FPO";
  return `UKIHDP-${prefix}-${suffix}`;
}

function subscribeToConnectivity(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function SurveyForm() {
  const formInstanceId = useId().replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const [instrument, setInstrument] = useState<Instrument>("household");
  const questionnaire = instrument === "household" ? householdQuestionnaire : institutionalQuestionnaire;
  const [responses, setResponses] = useState<AnswerMap>({});
  const [activeSection, setActiveSection] = useState(0);
  const [draftId, setDraftId] = useState(() => makeDraftId("household", formInstanceId));
  const [startedAt, setStartedAt] = useState(() => new Date().toISOString());
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [notice, setNotice] = useState("");
  const online = useSyncExternalStore(subscribeToConnectivity, () => navigator.onLine, () => true);

  const configuredFields = useMemo(() => countConfiguredFields(questionnaire), [questionnaire]);
  const selectedFpo = findFpo(String(responses[instrument === "household" ? "1.7" : "11.1"] ?? ""));

  const optionsForQuestion = (question: QuestionDefinition) => {
    if (question.id === "1.5") return projectMaster.districts;
    if (question.id === "1.6") return blocksForDistrict(String(responses["1.5"] ?? ""));
    if (question.id === "1.7") return fposForLocation(String(responses["1.5"] ?? ""), String(responses["1.6"] ?? "")).map((item) => item.name);
    if (question.id === "1.8") return selectedFpo ? [...selectedFpo.villages, "Other - Specify"] : [];
    if (question.id === "11.1") return projectFpos.map((item) => item.name);
    if (question.id === "3.1a") return selectedFpo ? [...selectedFpo.focusCrops, "Other"] : ["Other"];
    return question.options;
  };

  useEffect(() => {
    if (Object.keys(responses).length === 0) return;
    const timer = window.setTimeout(() => {
      saveSurveyDraft({
        id: draftId,
        questionnaireId: questionnaire.id,
        questionnaireVersion: questionnaire.version,
        status: "draft",
        updatedAt: new Date().toISOString(),
        sectionData: { answers: responses as Record<string, unknown> },
      }).then(() => setSaveState("saved")).catch(() => setSaveState("error"));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [draftId, questionnaire.id, questionnaire.version, responses]);

  const automaticValue = (question: QuestionDefinition, context: AnswerMap): string => {
    if (question.calculation === "survey_id") return draftId;
    if (question.id === "QC1") return new Date(startedAt).toLocaleString();
    if (question.id === "QC2") return "Captured when submitted";
    if (question.id === "QC4") {
      const gps = responses["1.11"] as Record<string, unknown> | undefined;
      return gps?.accuracy ? `${Math.round(Number(gps.accuracy))} metres` : "Capture GPS first";
    }
    if (question.id === "10.8") {
      return projectMaster.youthAgeRange ? `${projectMaster.youthAgeRange.min}-${projectMaster.youthAgeRange.max} years` : "Pending approved youth age range";
    }
    if (question.calculation === "sum" || question.calculation === "cost_total") {
      const total = (question.dependsOn ?? []).reduce((sum, id) => sum + sumNumbers(context[id]), 0);
      return total ? `INR ${total.toLocaleString("en-IN")}` : "Calculated from entered values";
    }
    if (question.calculation === "yield") {
      const area = context["3.3"] as { value?: unknown; unit?: string } | undefined;
      const production = context["3.5"] as { value?: unknown; unit?: string } | undefined;
      if (!area?.value || !production?.value) return "Calculated after area and production are entered";
      if (area.unit === "Nali") return "Pending approved Nali conversion factor";
      const kilograms = numberValue(production) * (production.unit === "Tonne" ? 1000 : production.unit === "Quintal" ? 100 : 1);
      const acres = numberValue(area) * (area.unit === "Hectare" ? 2.47105 : 1);
      if (!acres) return "Area must be greater than zero";
      const perAcre = kilograms / acres;
      return `${perAcre.toFixed(1)} kg/acre | ${(perAcre * 2.47105).toFixed(1)} kg/ha`;
    }
    if (question.calculation === "focus_crop_status") {
      if (!selectedFpo) return "Select FPO first";
      if (question.id === "3.11") {
        const crop = String(context["3.1a"] ?? "").toLowerCase();
        return selectedFpo.focusCrops.some((item) => item.toLowerCase() === crop) ? "Focus crop" : "Other crop";
      }
      const crops = responses["3.1"] as AnswerMap[] | undefined;
      if (!crops?.length) return "Pending crop roster";
      return crops.some((crop) => selectedFpo.focusCrops.some((item) => item.toLowerCase() === String(crop["3.1a"] ?? "").toLowerCase())) ? "Grower" : "Non-grower";
    }
    if (question.calculation === "interview_duration") {
      return "Calculated automatically when submitted";
    }
    if (question.calculation === "completeness") {
      const required = questionnaire.sections.flatMap((item) => item.questions).filter((item) => item.required && isVisible(item, responses));
      const missing = required.filter((item) => !hasValue(responses[item.id]));
      return missing.length ? `Warning: ${missing.length} required response(s) missing` : "Complete - required responses present";
    }
    return question.helpText ?? "Calculated automatically";
  };

  const resolveValue = (id: string, context: AnswerMap) => {
    if (context[id] !== undefined) return context[id];
    const definition = findQuestion(questionnaire, id);
    if (definition?.inputType === "automatic") return automaticValue(definition, context);
    return responses[id];
  };

  function matchesRule(rule: VisibilityRule, context: AnswerMap) {
    const actual = resolveValue(rule.questionId, context);
    if (rule.operator === "not_empty") return hasValue(actual);
    if (rule.operator === "not_equals") return actual !== rule.value;
    if (rule.operator === "includes") return Array.isArray(actual) && actual.includes(rule.value as never);
    return actual === rule.value;
  }

  function isVisible(question: QuestionDefinition, context: AnswerMap) {
    if (!question.showWhen) return true;
    const rules = Array.isArray(question.showWhen) ? question.showWhen : [question.showWhen];
    return rules.every((rule) => matchesRule(rule, context));
  }

  const switchInstrument = (next: Instrument) => {
    if (next === instrument) return;
    setInstrument(next);
    setResponses({});
    setActiveSection(0);
    setDraftId(makeDraftId(next, formInstanceId));
    setStartedAt(new Date().toISOString());
    setNotice("");
  };

  const updateResponse = (id: string, value: AnswerValue) => {
    setSaveState("saving");
    setResponses((current) => {
      const next = { ...current, [id]: value };
      if (id === "1.5") {
        delete next["1.6"];
        delete next["1.7"];
        delete next["1.8"];
      }
      if (id === "1.6") {
        delete next["1.7"];
        delete next["1.8"];
      }
      if (id === "1.7") delete next["1.8"];
      return next;
    });
    setNotice("");
  };

  const saveNow = async () => {
    setSaveState("saving");
    try {
      await saveSurveyDraft({
        id: draftId,
        questionnaireId: questionnaire.id,
        questionnaireVersion: questionnaire.version,
        status: "draft",
        updatedAt: new Date().toISOString(),
        sectionData: { answers: responses as Record<string, unknown> },
      });
      setSaveState("saved");
      setNotice("Draft saved safely on this device.");
    } catch {
      setSaveState("error");
      setNotice("This browser could not save the offline draft.");
    }
  };

  const submitForReview = async () => {
    const required = questionnaire.sections.flatMap((item) => item.questions).filter((item) => item.required && isVisible(item, responses));
    const firstMissing = required.find((item) => !hasValue(responses[item.id]));
    if (firstMissing) {
      const sectionIndex = questionnaire.sections.findIndex((item) => item.questions.some((question) => question.id === firstMissing.id));
      if (sectionIndex >= 0) setActiveSection(sectionIndex);
      setNotice(`Please complete required field ${firstMissing.id}: ${firstMissing.label}`);
      return;
    }
    await saveNow();
    try {
      await queueSurveyForSync(draftId);
      setNotice(online ? "Survey queued for secure server synchronization and reviewer submission." : "Survey queued. It will synchronize when connectivity returns.");
    } catch {
      setNotice("The survey is saved, but it could not be placed in the synchronization queue.");
    }
  };

  const consentDeclined = instrument === "household" && responses["1.1"] === "No - Consent Not Provided";
  const current = questionnaire.sections[activeSection];
  const answeredCount = questionnaire.sections.flatMap((item) => item.questions).filter((question) => question.inputType !== "automatic" && hasValue(responses[question.id])).length;
  const progress = Math.round((answeredCount / Math.max(1, questionnaire.sections.flatMap((item) => item.questions).filter((question) => question.inputType !== "automatic").length)) * 100);

  return <main className="survey-page">
    <header className="survey-topbar">
      <div className="survey-brand"><Link href="/">&larr; Dashboard</Link><span>UKIHDP Data Collection</span></div>
      <div className="survey-status"><span className={online ? "online" : "offline"}>{online ? "Online" : "Offline"}</span><span>{saveState === "saving" ? "Saving..." : saveState === "error" ? "Save error" : "Saved on device"}</span></div>
    </header>

    <section className="survey-heading">
      <div><p>Configurable field instrument</p><h1>{questionnaire.title}</h1><span>{configuredFields} configured fields including repeat groups</span></div>
      <div className="instrument-toggle"><button className={instrument === "household" ? "active" : ""} onClick={() => switchInstrument("household")}>Household survey</button><button className={instrument === "institutional" ? "active" : ""} onClick={() => switchInstrument("institutional")}>FPO assessment</button></div>
    </section>

    <div className="survey-progress"><div style={{ width: `${progress}%` }} /><span>{progress}% completed</span></div>

    <div className="survey-workspace">
      <aside className="section-navigation">
        <p>Questionnaire sections</p>
        {questionnaire.sections.map((item, index) => <button key={item.id} className={index === activeSection ? "active" : ""} onClick={() => setActiveSection(index)}><span>{String(item.order).padStart(2, "0")}</span><div><b>{item.shortTitle}</b><small>{item.questions.length} question groups</small></div></button>)}
      </aside>

      <section className="form-card">
        <header><div><p>Section {current.order} of {questionnaire.sections.length}</p><h2>{current.title}</h2><span>{current.description}</span></div><b>{questionnaire.version}</b></header>

        {selectedFpo && <div className="fpo-context"><div><span>Selected FPO</span><strong>{selectedFpo.name}</strong></div><div><span>Block / District</span><strong>{selectedFpo.block} / {selectedFpo.district}</strong></div><div><span>CBBO</span><strong>{selectedFpo.cbbo}</strong></div><div><span>Focus crop(s)</span><strong>{selectedFpo.cropNote ?? selectedFpo.focusCrops.join(", ")}</strong></div><div><span>Configured villages</span><strong>{selectedFpo.villages.length}</strong></div></div>}

        {consentDeclined ? <div className="consent-stop"><strong>Interview ended</strong><p>The respondent did not provide consent. Do not collect any additional information. Save this record only as a consent refusal if required by the approved protocol.</p><button onClick={saveNow}>Save consent outcome</button></div> : <div className="question-list">
          {current.questions.map((question) => isVisible(question, responses) ? <QuestionField key={question.id} question={question} resolvedOptions={optionsForQuestion(question)} value={question.inputType === "automatic" ? automaticValue(question, responses) : responses[question.id]} update={(value) => updateResponse(question.id, value)} isVisible={isVisible} automaticValue={automaticValue} optionsForQuestion={optionsForQuestion} /> : null)}
        </div>}

        {notice && <div className="form-notice" role="status">{notice}</div>}

        <footer className="form-actions">
          <button className="secondary" onClick={saveNow}>Save draft</button>
          <div><button className="ghost" disabled={activeSection === 0} onClick={() => setActiveSection((value) => Math.max(0, value - 1))}>Previous</button>{activeSection < questionnaire.sections.length - 1 ? <button className="primary" onClick={() => setActiveSection((value) => Math.min(questionnaire.sections.length - 1, value + 1))}>Save & continue</button> : <button className="primary" onClick={submitForReview}>Submit for review</button>}</div>
        </footer>
      </section>
    </div>
  </main>;
}

interface QuestionFieldProps {
  question: QuestionDefinition;
  resolvedOptions?: string[];
  value: AnswerValue | string | undefined;
  update: (value: AnswerValue) => void;
  isVisible: (question: QuestionDefinition, context: AnswerMap) => boolean;
  automaticValue: (question: QuestionDefinition, context: AnswerMap) => string;
  optionsForQuestion: (question: QuestionDefinition) => string[] | undefined;
}

function QuestionField({ question, resolvedOptions, value, update, isVisible, automaticValue, optionsForQuestion }: QuestionFieldProps) {
  const fieldId = `field-${question.id.replaceAll(".", "-")}`;
  const options = resolvedOptions ?? question.options ?? [];
  const wrapper = (content: React.ReactNode) => <article className={`question ${question.inputType === "repeat_group" ? "repeat-question" : ""}`}>
    <div className="question-label"><span>{question.id}</span><div><label htmlFor={fieldId}>{question.label}{question.required && <b> *</b>}</label>{question.recallPeriod && <small>Recall: {question.recallPeriod}</small>}{question.helpText && <p>{question.helpText}</p>}</div></div>
    <div className="question-input">{content}</div>
  </article>;

  if (question.inputType === "automatic") return wrapper(<div className="automatic-value">{String(value ?? "Calculated automatically")}</div>);
  if (question.inputType === "textarea") return wrapper(<textarea id={fieldId} value={String(value ?? "")} placeholder={question.placeholder} onChange={(event) => update(event.target.value)} rows={4} />);
  if (["text", "phone", "number", "currency", "year", "date"].includes(question.inputType)) {
    const type = question.inputType === "text" ? "text" : question.inputType === "phone" ? "tel" : question.inputType === "date" ? "date" : "number";
    return wrapper(<div className="input-with-unit">{question.inputType === "currency" && <span>INR</span>}<input id={fieldId} type={type} value={String(value ?? "")} placeholder={question.placeholder} min={question.validation?.min} max={question.validation?.max} onChange={(event) => update(type === "number" ? (event.target.value === "" ? "" : Number(event.target.value)) : event.target.value)} />{question.unit && question.inputType !== "currency" && <span>{question.unit}</span>}</div>);
  }
  if (question.inputType === "unit_number") {
    const item = (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as { value?: string | number; unit?: string };
    return wrapper(<div className="unit-input"><input id={fieldId} type="number" min={question.validation?.min ?? 0} value={String(item.value ?? "")} onChange={(event) => update({ ...item, value: event.target.value === "" ? "" : Number(event.target.value) })} /><select value={item.unit ?? question.unitOptions?.[0] ?? ""} onChange={(event) => update({ ...item, unit: event.target.value })}>{question.unitOptions?.map((unitName) => <option key={unitName}>{unitName}</option>)}</select></div>);
  }
  if (question.inputType === "select") return wrapper(<select id={fieldId} value={String(value ?? "")} onChange={(event) => update(event.target.value)}><option value="">Select an option</option>{options.map((option) => <option key={option}>{option}</option>)}</select>);
  if (question.inputType === "search_select") return wrapper(<><input id={fieldId} list={`${fieldId}-options`} value={String(value ?? "")} placeholder={options.length ? "Search or type a value" : "Type value - master list pending"} onChange={(event) => update(event.target.value)} /><datalist id={`${fieldId}-options`}>{options.map((option) => <option key={option} value={option} />)}</datalist></>);
  if (question.inputType === "radio") return wrapper(<div className="choice-grid">{options.map((option) => <label className={value === option ? "selected" : ""} key={option}><input type="radio" name={fieldId} checked={value === option} onChange={() => update(option)} /><span>{option}</span></label>)}</div>);
  if (question.inputType === "multiselect") {
    const selected = Array.isArray(value) ? value as string[] : [];
    return wrapper(<div className="choice-grid multi">{options.map((option) => <label className={selected.includes(option) ? "selected" : ""} key={option}><input type="checkbox" checked={selected.includes(option)} onChange={() => update(selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option])} /><span>{option}</span></label>)}</div>);
  }
  if (question.inputType === "matrix" || question.inputType === "numeric_matrix") {
    const matrix = (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Record<string, unknown>;
    return wrapper(<div className="matrix-wrap"><table><thead><tr><th>Item</th>{question.columns?.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{question.rows?.map((row) => <tr key={row}><th>{row}</th>{question.columns?.map((column) => <td key={column}>{question.inputType === "numeric_matrix" ? <input aria-label={`${row} ${column}`} type="number" min="0" value={String((matrix[row] as Record<string, unknown> | undefined)?.[column] ?? "")} onChange={(event) => update({ ...matrix, [row]: { ...((matrix[row] as object | undefined) ?? {}), [column]: event.target.value === "" ? "" : Number(event.target.value) } })} /> : <input aria-label={`${row}: ${column}`} type="radio" name={`${fieldId}-${row}`} checked={matrix[row] === column} onChange={() => update({ ...matrix, [row]: column })} />}</td>)}</tr>)}</tbody></table></div>);
  }
  if (question.inputType === "rank") {
    const ranks = (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Record<string, number>;
    const maximum = question.validation?.maxSelections ?? 3;
    return wrapper(<div className="rank-list">{options.map((option) => <label key={option}><span>{option}</span><select value={ranks[option] ?? ""} onChange={(event) => { const next = { ...ranks }; const rank = Number(event.target.value); if (!rank) delete next[option]; else { Object.keys(next).forEach((key) => { if (next[key] === rank) delete next[key]; }); next[option] = rank; } update(next); }}><option value="">Not ranked</option>{Array.from({ length: maximum }, (_, index) => index + 1).map((rank) => <option key={rank} value={rank}>Rank {rank}</option>)}</select></label>)}</div>);
  }
  if (question.inputType === "gps") {
    const gps = (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Record<string, unknown>;
    const captureGps = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition((position) => update({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, timestamp: new Date().toISOString() }), undefined, { enableHighAccuracy: true, timeout: 20000 });
    };
    return wrapper(<div className="gps-field"><button type="button" onClick={captureGps}>{gps.latitude ? "Recapture GPS" : "Capture GPS"}</button>{gps.latitude ? <span>{Number(gps.latitude).toFixed(6)}, {Number(gps.longitude).toFixed(6)} | accuracy {Math.round(Number(gps.accuracy))} m</span> : <span>No location captured</span>}</div>);
  }
  if (question.inputType === "repeat_group") {
    const entries = Array.isArray(value) ? value as AnswerMap[] : [];
    return wrapper(<div className="repeat-list">{entries.map((entry, index) => <section className="repeat-card" key={`${question.id}-${index}`}><header><strong>{question.repeatLabel ?? "record"} {index + 1}</strong><button type="button" onClick={() => update(entries.filter((_, entryIndex) => entryIndex !== index))}>Remove</button></header>{question.fields?.map((field) => isVisible(field, entry) ? <QuestionField key={field.id} question={field} resolvedOptions={optionsForQuestion(field)} value={field.inputType === "automatic" ? automaticValue(field, entry) : entry[field.id]} update={(fieldValue) => update(entries.map((item, entryIndex) => entryIndex === index ? { ...item, [field.id]: fieldValue } : item))} isVisible={isVisible} automaticValue={automaticValue} optionsForQuestion={optionsForQuestion} /> : null)}</section>)}<button type="button" className="add-repeat" onClick={() => update([...entries, {}])}>+ Add {question.repeatLabel ?? "record"}</button></div>);
  }
  return wrapper(<div className="automatic-value">Input type pending</div>);
}
