import type { CbtQuestion } from "./cbtFilters";
export interface Figure {
  src?: string;
  url?: string;
  caption?: string;
  alt?: string;
  width?: number;
  height?: number;
  role?: string;
  optionIndex?: number;
  assetId?: string;
}
export interface Question extends CbtQuestion {
  explanation: string;
  passage?: string | null;
  figures?: Figure[];
  questionHtml?: string;
  optionsHtml?: string[];
  explanationHtml?: string;
  answerHtml?: string;
  answerText?: string | null;
  type?: string;
  sourceBundleId?: string;
}
export interface Asset {
  mime: string;
  data: string;
}
export interface Bundle {
  id: string;
  title: string;
  questions: Question[];
  question_count?: number;
  assets?: Record<string, Asset>;
  updatedAt?: string;
  sourceSessionId?: string;
  ownerId?: string;
  examType?: string;
  university?: string;
  manufacturer?: string;
  kind?: string;
  downloadedParts?: string[];
  partialDownload?: boolean;
  downloadBytes?: number;
  [key: string]: unknown;
}
export interface Material {
  id: string;
  bundleId: string;
  name: string;
  title?: string;
  questionCount?: number;
  subjects?: string[];
  yearMin?: number;
  yearMax?: number;
}
export interface CatalogExam {
  id: string;
  name: string;
  manufacturers: Material[];
  materials?: Material[];
}
export interface Organization {
  id: string;
  name: string;
  shortName?: string;
  type?: string;
  examTypes: CatalogExam[];
}
export interface Catalog {
  organizations?: Organization[];
  universities: Organization[];
  ungrouped?: Material[];
}
export interface Attempt {
  id: string;
  owner: string;
  bundleId: string;
  title: string;
  questions: Question[];
  assets?: Record<string, Asset>;
  answers: (number | null)[];
  written: string[];
  flagged: boolean[];
  current: number;
  duration: number;
  startedAt: number;
  deadline: number;
  completedAt?: number;
  mode: "practice" | "full";
  status: "active" | "completed";
  version?: string;
}
export interface Bookmark {
  id: string;
  owner: string;
  bundleId: string;
  title: string;
  question: Question;
  assets?: Record<string, Asset>;
  note: string;
  createdAt: number;
}
export interface Profile {
  id: string;
  email: string;
  full_name: string;
  onboarding_complete?: boolean;
  undergraduate?: boolean;
  study_focus?: { id: string; name: string; kind: string } | null;
  avatar_url?: string;
  avatar_local_uri?: string;
  phone_number?: string;
}
export type ThemeMode = "dark" | "light" | "system";
export interface Preferences {
  theme: ThemeMode;
  preparation: boolean;
  reminders: {
    enabled: boolean;
    mode: "smart" | "fixed";
    time: string;
    days: number[];
    personalized: boolean;
  };
  focus?: string;
}
export interface StudySession {
  id: string;
  title: string;
  kind: "exam" | "tutorial";
  status: "upcoming" | "live" | "ended";
  visibility: "public" | "private";
  logo?: string;
  tag?: string;
  startsAt?: string;
  joined: boolean;
}
export interface VisionSession {
  ingest?: unknown;
  id: string;
  name: string;
  status: string;
  questions?: Question[];
  assets?: Record<string, Asset>;
  progress?: {
    total: number;
    done: number;
    failed: number;
    needsInput: number;
  };
  pages?: { id: string; index: number; status: string }[];
  followUps?: {
    id: string;
    message: string;
    status: string;
    type: string;
    pageId?: string;
  }[];
}
export interface QuestionReport {
  id: string;
  owner: string;
  bundleId: string;
  questionId: string;
  version: string | null;
  category: string;
  note: string;
  subject: string;
  year?: string;
  status: string;
  createdAt: string;
  resolution?: string;
}
