import type { QuestionnaireDefinition } from "@/lib/survey/types";

export type StudyStatus = "draft" | "active" | "paused" | "completed" | "archived";
export type StudyRole = "study_manager" | "supervisor" | "reviewer" | "enumerator";

export interface StudyDefinition {
  id: string;
  code: string;
  fullName: string;
  shortName: string;
  description: string;
  studyType: string;
  organisation: string;
  studyLead: string;
  contactPerson: string;
  startDate: string;
  endDate: string;
  status: StudyStatus;
  geographicCoverage: string[];
  targetSample: number;
  treatmentTarget?: number;
  controlTarget?: number;
  questionnaireId: string;
  questionnaireVersion: string;
  questionnaireStatus: "not_imported" | "validated" | "published";
  questionnaire?: QuestionnaireDefinition;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  builtIn?: boolean;
}

export interface StudyAssignment {
  id: string;
  studyId: string;
  userId: string;
  roleInStudy: StudyRole;
  district?: string;
  block?: string;
  fpo?: string;
  villages: string[];
  sampleGroup?: "treatment" | "control" | "both";
  startDate?: string;
  endDate?: string;
  active: boolean;
}

export interface QuestionnaireValidationIssue {
  severity: "error" | "warning";
  code: string;
  sheet: string;
  row?: number;
  message: string;
}

export interface QuestionnaireImportResult {
  questionnaire: QuestionnaireDefinition | null;
  issues: QuestionnaireValidationIssue[];
  sourceFileName: string;
  importedAt: string;
  statistics: {
    sections: number;
    questions: number;
    options: number;
    skipRules: number;
    calculations: number;
    masterDataLinks: number;
  };
}
