export type Source = "djinni" | "dou";

export type VacancySummary = {
  source: Source;
  url: string;
  title: string;
  company?: string;
  publishedAt?: string;
  discoveredAt: string;
};

export type VacancyDetails = VacancySummary & {
  description: string;
  location?: string;
  compensation?: string;
};

export type AnalysisResult = {
  score: number;
  analysisText: string;
};

export type StoredVacancy = {
  source: Source;
  url: string;
  contentHash: string;
  analyzedAt?: string;
  score?: number;
};
