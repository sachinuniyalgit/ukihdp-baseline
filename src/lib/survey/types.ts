export type AppRole = "admin" | "researcher" | "supervisor" | "reviewer" | "enumerator";

export type SurveyStatus =
  | "draft"
  | "queued"
  | "submitted"
  | "under_review"
  | "returned"
  | "approved";

export type QuestionInputType =
  | "text"
  | "textarea"
  | "number"
  | "decimal"
  | "currency"
  | "year"
  | "date"
  | "time"
  | "datetime"
  | "phone"
  | "radio"
  | "select"
  | "search_select"
  | "multiselect"
  | "unit_number"
  | "matrix"
  | "numeric_matrix"
  | "rank"
  | "automatic"
  | "gps"
  | "photo"
  | "file"
  | "signature"
  | "readonly"
  | "focus_crop_modules"
  | "repeat_group";

export type AnswerValue =
  | string
  | number
  | boolean
  | string[]
  | Record<string, unknown>
  | Array<Record<string, unknown>>
  | null;

export interface VisibilityRule {
  questionId: string;
  operator?: "equals" | "not_equals" | "includes" | "not_empty";
  value?: string | number | boolean;
}

export interface QuestionDefinition {
  id: string;
  label: string;
  inputType: QuestionInputType;
  required?: boolean;
  options?: string[];
  unit?: string;
  unitOptions?: string[];
  placeholder?: string;
  helpText?: string;
  rows?: string[];
  columns?: string[];
  fields?: QuestionDefinition[];
  repeatLabel?: string;
  minRepeats?: number;
  maxRepeats?: number;
  showWhen?: VisibilityRule | VisibilityRule[];
  calculation?:
    | "survey_id"
    | "sum"
    | "yield"
    | "cost_total"
    | "loss_percentage"
    | "interview_duration"
    | "completeness"
    | "focus_crop_status"
    | "focus_crop_matches"
    | "crop_category"
    | "youth_status";
  formula?: string;
  dependsOn?: string[];
  recallPeriod?: string;
  treatmentControlApplicability?: "both" | "treatment" | "control";
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    maxSelections?: number;
  };
  indicatorMapping?: string;
  masterDataLink?: {
    type: string;
    filterRule?: string;
  };
}

export interface SurveySectionDefinition {
  id: string;
  order: number;
  title: string;
  shortTitle: string;
  instrument: "household" | "institutional";
  description: string;
  questions: QuestionDefinition[];
}

export interface QuestionnaireDefinition {
  id: string;
  title: string;
  version: string;
  status: "draft" | "published" | "archived";
  sections: SurveySectionDefinition[];
}
