import * as XLSX from "xlsx";
import type { QuestionnaireImportResult, QuestionnaireValidationIssue } from "@/lib/studies/types";
import type { QuestionDefinition, QuestionInputType, QuestionnaireDefinition, SurveySectionDefinition, VisibilityRule } from "@/lib/survey/types";

type Row = Record<string, unknown>;

const requiredOptionTypes = new Set(["radio", "select", "search_select", "multiselect"]);
const typeMap: Record<string, QuestionInputType> = {
  text: "text",
  "long text": "textarea",
  integer: "number",
  decimal: "decimal",
  currency: "currency",
  "yes/no": "radio",
  "single select": "radio",
  "multi select": "multiselect",
  dropdown: "select",
  "searchable dropdown": "search_select",
  date: "date",
  time: "time",
  "date-time": "datetime",
  datetime: "datetime",
  gps: "gps",
  photo: "photo",
  "file upload": "file",
  signature: "signature",
  matrix: "matrix",
  "repeating group / roster": "repeat_group",
  "repeating group": "repeat_group",
  roster: "repeat_group",
  "calculated field": "automatic",
  "read-only field": "readonly",
};

const text = (value: unknown) => String(value ?? "").trim();
const number = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const truthy = (value: unknown) => ["true", "yes", "1", "required"].includes(text(value).toLowerCase());
const rowsFromSheet = (workbook: XLSX.WorkBook, name: string): Row[] => {
  const sheet = workbook.Sheets[name] ?? workbook.Sheets[Object.keys(workbook.Sheets).find((key) => key.toLowerCase() === name.toLowerCase()) ?? ""];
  return sheet ? XLSX.utils.sheet_to_json<Row>(sheet, { defval: "" }) : [];
};

export async function parseQuestionnaireFile(file: File): Promise<QuestionnaireImportResult> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const isCsv = file.name.toLowerCase().endsWith(".csv");
  const studyRows = isCsv ? [] : rowsFromSheet(workbook, "STUDY");
  let sectionRows = isCsv ? [] : rowsFromSheet(workbook, "SECTIONS");
  const questionRows = isCsv ? XLSX.utils.sheet_to_json<Row>(workbook.Sheets[workbook.SheetNames[0]], { defval: "" }) : rowsFromSheet(workbook, "QUESTIONS");
  const optionRows = isCsv ? [] : rowsFromSheet(workbook, "OPTIONS");
  const skipRows = isCsv ? [] : rowsFromSheet(workbook, "SKIP_LOGIC");
  const calculationRows = isCsv ? [] : rowsFromSheet(workbook, "CALCULATIONS");
  const masterDataRows = isCsv ? [] : rowsFromSheet(workbook, "MASTER_DATA_LINKS");
  const issues: QuestionnaireValidationIssue[] = [];

  if (isCsv) {
    const sectionIds = [...new Set(questionRows.map((row) => text(row.section_id)).filter(Boolean))];
    sectionRows = sectionIds.map((sectionId, index) => ({ section_id: sectionId, section_order: index + 1, section_name: sectionId, section_description: "Imported from CSV" }));
    issues.push({ severity: "warning", code: "CSV_SIMPLE_IMPORT", sheet: "QUESTIONS", message: "CSV supports a simple question list. Use the XLSX template for options, skip logic, calculations, and master-data links." });
  }

  const study = studyRows[0] ?? {};
  const studyCode = text(study.study_code) || file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  const studyName = text(study.study_name) || studyCode;

  if (!sectionRows.length) issues.push({ severity: "error", code: "MISSING_SECTIONS", sheet: "SECTIONS", message: "No questionnaire sections were found." });
  if (!questionRows.length) issues.push({ severity: "error", code: "MISSING_QUESTIONS", sheet: "QUESTIONS", message: "No questionnaire questions were found." });

  const sectionIds = new Set<string>();
  sectionRows.forEach((row, index) => {
    const id = text(row.section_id);
    if (!id) issues.push({ severity: "error", code: "MISSING_SECTION_ID", sheet: "SECTIONS", row: index + 2, message: "Section ID is required." });
    else if (sectionIds.has(id)) issues.push({ severity: "error", code: "DUPLICATE_SECTION_ID", sheet: "SECTIONS", row: index + 2, message: `Section ID ${id} is duplicated.` });
    sectionIds.add(id);
  });

  const questionIds = new Set<string>();
  const optionsByQuestion = new Map<string, Array<{ value: string; label: string; order: number }>>();
  optionRows.forEach((row) => {
    const id = text(row.question_id);
    if (!optionsByQuestion.has(id)) optionsByQuestion.set(id, []);
    optionsByQuestion.get(id)?.push({ value: text(row.option_value), label: text(row.option_label) || text(row.option_value), order: number(row.option_order, 999) });
  });

  questionRows.forEach((row, index) => {
    const id = text(row.question_id);
    const sectionId = text(row.section_id);
    const importedType = text(row.question_type).toLowerCase();
    if (!id) issues.push({ severity: "error", code: "MISSING_QUESTION_ID", sheet: "QUESTIONS", row: index + 2, message: "Question ID is required." });
    else if (questionIds.has(id)) issues.push({ severity: "error", code: "DUPLICATE_QUESTION_ID", sheet: "QUESTIONS", row: index + 2, message: `Question ID ${id} is duplicated.` });
    questionIds.add(id);
    if (!sectionIds.has(sectionId)) issues.push({ severity: "error", code: "MISSING_SECTION_REFERENCE", sheet: "QUESTIONS", row: index + 2, message: `Question ${id || index + 1} refers to unknown section ${sectionId || "(blank)"}.` });
    const inputType = typeMap[importedType];
    if (!inputType) issues.push({ severity: "error", code: "INVALID_QUESTION_TYPE", sheet: "QUESTIONS", row: index + 2, message: `Question ${id || index + 1} uses unsupported type “${text(row.question_type)}”.` });
    if (inputType && requiredOptionTypes.has(inputType) && importedType !== "yes/no" && !(optionsByQuestion.get(id)?.length)) {
      issues.push({ severity: "error", code: "MISSING_OPTIONS", sheet: "OPTIONS", message: `Question ${id} requires at least one option.` });
    }
  });

  const skipRulesByTarget = new Map<string, VisibilityRule[]>();
  const skipGraph = new Map<string, string[]>();
  skipRows.forEach((row, index) => {
    const source = text(row.source_question_id);
    const target = text(row.target_question_id);
    if (!questionIds.has(source) || !questionIds.has(target)) {
      issues.push({ severity: "error", code: "BROKEN_SKIP_LOGIC", sheet: "SKIP_LOGIC", row: index + 2, message: `Skip rule references a missing source or target question (${source} → ${target}).` });
      return;
    }
    const operator = normalizeOperator(text(row.operator));
    const action = text(row.action).toLowerCase();
    const rule: VisibilityRule = { questionId: source, operator: action === "hide" ? invertOperator(operator) : operator, value: text(row.condition_value) };
    if (!skipRulesByTarget.has(target)) skipRulesByTarget.set(target, []);
    skipRulesByTarget.get(target)?.push(rule);
    if (!skipGraph.has(source)) skipGraph.set(source, []);
    skipGraph.get(source)?.push(target);
  });
  if (hasCycle(skipGraph)) issues.push({ severity: "error", code: "CIRCULAR_LOGIC", sheet: "SKIP_LOGIC", message: "Circular skip logic was detected. Remove the circular question dependency before publishing." });

  const calculationByOutput = new Map<string, { formula: string; sources: string[] }>();
  calculationRows.forEach((row, index) => {
    const output = text(row.output_variable);
    const sources = text(row.source_variables).split(/[,;|]/).map((item) => item.trim()).filter(Boolean);
    const missing = sources.filter((source) => !questionIds.has(source));
    if (!output || !questionIds.has(output) || missing.length) {
      issues.push({ severity: "error", code: "INVALID_CALCULATION", sheet: "CALCULATIONS", row: index + 2, message: `Calculation ${text(row.calculation_id) || index + 1} has a missing output or source variable${missing.length ? `: ${missing.join(", ")}` : "."}` });
    } else calculationByOutput.set(output, { formula: text(row.formula), sources });
  });

  const masterDataByQuestion = new Map<string, { type: string; filterRule?: string }>();
  masterDataRows.forEach((row, index) => {
    const questionId = text(row.question_id);
    const masterDataType = text(row.master_data_type);
    if (!questionIds.has(questionId) || !masterDataType) {
      issues.push({ severity: "error", code: "INVALID_MASTER_DATA_LINK", sheet: "MASTER_DATA_LINKS", row: index + 2, message: `Master-data link requires an existing question and a data type (${questionId || "blank question"}).` });
      return;
    }
    if (masterDataByQuestion.has(questionId)) issues.push({ severity: "warning", code: "DUPLICATE_MASTER_DATA_LINK", sheet: "MASTER_DATA_LINKS", row: index + 2, message: `Question ${questionId} has more than one master-data link; the last valid link is used.` });
    masterDataByQuestion.set(questionId, { type: masterDataType, filterRule: text(row.filter_rule) || undefined });
  });

  const sections: SurveySectionDefinition[] = sectionRows
    .filter((row) => text(row.section_id))
    .sort((a, b) => number(a.section_order, 999) - number(b.section_order, 999))
    .map((sectionRow, sectionIndex) => {
      const id = text(sectionRow.section_id);
      const questions: QuestionDefinition[] = questionRows
        .filter((row) => text(row.section_id) === id && text(row.question_id))
        .sort((a, b) => number(a.question_order, 999) - number(b.question_order, 999))
        .map((row) => {
          const questionId = text(row.question_id);
          const importedType = text(row.question_type).toLowerCase();
          const inputType = typeMap[importedType] ?? "text";
          const optionItems = optionsByQuestion.get(questionId)?.sort((a, b) => a.order - b.order) ?? [];
          const calculation = calculationByOutput.get(questionId);
          return {
            id: questionId,
            label: text(row.question_text) || questionId,
            inputType: calculation ? "automatic" : inputType,
            required: truthy(row.required),
            helpText: text(row.help_text) || undefined,
            recallPeriod: text(row.reference_period) || undefined,
            unit: text(row.unit) || undefined,
            options: importedType === "yes/no" ? ["Yes", "No"] : optionItems.map((option) => option.label),
            showWhen: skipRulesByTarget.get(questionId),
            calculation: calculation ? "sum" : undefined,
            formula: calculation?.formula,
            dependsOn: calculation?.sources,
            masterDataLink: masterDataByQuestion.get(questionId),
          } satisfies QuestionDefinition;
        });
      return {
        id,
        order: number(sectionRow.section_order, sectionIndex + 1),
        title: text(sectionRow.section_name) || id,
        shortTitle: text(sectionRow.section_name) || id,
        description: text(sectionRow.section_description),
        instrument: "household",
        questions,
      };
    });

  const questionnaire: QuestionnaireDefinition | null = sections.length ? {
    id: studyCode,
    title: studyName,
    version: "v1.0",
    status: issues.some((issue) => issue.severity === "error") ? "draft" : "published",
    sections,
  } : null;

  return {
    questionnaire,
    issues,
    sourceFileName: file.name,
    importedAt: new Date().toISOString(),
    statistics: { sections: sections.length, questions: questionRows.length, options: optionRows.length, skipRules: skipRows.length, calculations: calculationRows.length, masterDataLinks: masterDataRows.length },
  };
}

export function downloadQuestionnaireTemplate() {
  const workbook = XLSX.utils.book_new();
  append(workbook, "STUDY", [{ study_code: "study-code", study_name: "Study name", description: "Study description", study_type: "Baseline / Monitoring / Evaluation" }]);
  append(workbook, "SECTIONS", [{ section_id: "S1", section_order: 1, section_name: "Respondent profile", section_description: "Basic respondent information" }]);
  append(workbook, "QUESTIONS", [
    { question_id: "S1.Q1", section_id: "S1", question_order: 1, question_text: "Has consent been provided?", question_type: "Yes/No", required: "Yes", help_text: "End interview if No", reference_period: "Current", unit: "", validation_rule: "" },
    { question_id: "S1.Q2", section_id: "S1", question_order: 2, question_text: "District", question_type: "Dropdown", required: "Yes", help_text: "Select one", reference_period: "Current", unit: "", validation_rule: "" },
  ]);
  append(workbook, "OPTIONS", [{ question_id: "S1.Q2", option_value: "district-a", option_label: "District A", option_order: 1 }]);
  append(workbook, "SKIP_LOGIC", [{ source_question_id: "S1.Q1", operator: "equals", condition_value: "Yes", target_question_id: "S1.Q2", action: "show" }]);
  append(workbook, "CALCULATIONS", [{ calculation_id: "CALC-1", output_variable: "", formula: "", source_variables: "" }]);
  append(workbook, "MASTER_DATA_LINKS", [{ question_id: "S1.Q2", master_data_type: "district", filter_rule: "" }]);
  XLSX.writeFile(workbook, "FieldFlow-Questionnaire-Template.xlsx");
}

export function downloadValidationReport(issues: QuestionnaireValidationIssue[]) {
  const sheet = XLSX.utils.json_to_sheet(issues.map((issue) => ({ severity: issue.severity, code: issue.code, sheet: issue.sheet, row: issue.row ?? "", message: issue.message })));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "VALIDATION");
  XLSX.writeFile(workbook, "FieldFlow-Questionnaire-Validation.xlsx");
}

function append(workbook: XLSX.WorkBook, name: string, rows: Row[]) {
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), name);
}

function normalizeOperator(value: string): VisibilityRule["operator"] {
  const normalized = value.toLowerCase().replaceAll(" ", "_");
  if (normalized === "not_equals" || normalized === "not_equal") return "not_equals";
  if (normalized === "includes" || normalized === "contains") return "includes";
  if (normalized === "not_empty" || normalized === "answered") return "not_empty";
  return "equals";
}

function invertOperator(operator: VisibilityRule["operator"]): VisibilityRule["operator"] {
  return operator === "equals" ? "not_equals" : operator === "not_equals" ? "equals" : operator;
}

function hasCycle(graph: Map<string, string[]>) {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (node: string): boolean => {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    if ((graph.get(node) ?? []).some(visit)) return true;
    visiting.delete(node);
    visited.add(node);
    return false;
  };
  return [...graph.keys()].some(visit);
}
