export type AppRole = "admin" | "reviewer" | "enumerator";

export type SurveyStatus =
  | "draft"
  | "queued"
  | "submitted"
  | "under_review"
  | "returned"
  | "approved";

export type QuestionInputType =
  | "text"
  | "number"
  | "date"
  | "phone"
  | "radio"
  | "select"
  | "multiselect"
  | "gps"
  | "photo"
  | "repeat_group";

export interface QuestionDefinition {
  id: string;
  label: string;
  inputType: QuestionInputType;
  required?: boolean;
  options?: string[];
  unit?: string;
  showWhen?: {
    questionId: string;
    equals: string | number | boolean;
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
