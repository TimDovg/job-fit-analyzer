import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const rootDir = process.cwd();

const appConfigSchema = z.object({
  candidate: z.object({
    displayName: z.string().min(1).default("Configured candidate"),
    searchDescription: z.string().min(1).default("Front End vacancies")
  }).default({}),
  analysis: z.object({
    openaiModel: z.string().min(1).default("gpt-4.1-mini"),
    minScore: z.number().min(0).max(10).default(5),
    lookbackHours: z.number().positive().default(24),
    maxVacanciesPerSource: z.number().int().positive().default(20),
    maxAnalysesPerRun: z.number().int().positive().default(5)
  }).default({}),
  runtime: z.object({
    headless: z.boolean().default(true),
    dataDir: z.string().min(1).default("./data"),
    browserProfileDir: z.string().min(1).default("./browser-profile")
  }).default({}),
  skill: z.object({
    dir: z.string().min(1).default("./candidate/job-fit-analyzer"),
    skillFile: z.string().min(1).default("SKILL.md"),
    resumeFile: z.string().min(1).default("references/resume.md"),
    profileFile: z.string().min(1).default("references/candidate-profile.md")
  }).default({}),
  sources: z.object({
    djinni: z.object({
      enabled: z.boolean().default(true),
      dashboardUrl: z.string().url().default("https://djinni.co/my/dashboard/"),
      recommendedSectionName: z.string().min(1).default("Vacancies by my profile")
    }).default({}),
    dou: z.object({
      enabled: z.boolean().default(true),
      listingUrl: z.string().url().default("https://jobs.dou.ua/vacancies/?category=Front%20End&from=maybe"),
      categoryName: z.string().min(1).default("Front End")
    }).default({})
  }).default({}),
  telegram: z.object({
    enabled: z.boolean().default(true)
  }).default({})
}).default({});

export type AppConfig = z.infer<typeof appConfigSchema>;

function numberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a number`);
  }
  return parsed;
}

function booleanFromEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

function readAppConfig(): { config: AppConfig; path: string } {
  const configPath = resolvePath(process.env.JOB_WATCH_CONFIG, "./config/job-watch.config.json");
  const fallbackPath = resolvePath(undefined, "./config/job-watch.config.example.json");
  const selectedPath = fs.existsSync(configPath) ? configPath : fallbackPath;

  if (!fs.existsSync(selectedPath)) {
    return { config: appConfigSchema.parse({}), path: selectedPath };
  }

  const parsed = JSON.parse(fs.readFileSync(selectedPath, "utf8")) as unknown;
  return { config: appConfigSchema.parse(parsed), path: selectedPath };
}

function resolvePath(raw: string | undefined, fallback: string): string {
  return path.resolve(rootDir, raw || fallback);
}

function envString(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

const loaded = readAppConfig();
const app = loaded.config;

export const config = {
  configPath: loaded.path,
  candidate: app.candidate,
  sources: app.sources,
  telegram: app.telegram,
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiModel: envString("OPENAI_MODEL", app.analysis.openaiModel),
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
  telegramChatId: process.env.TELEGRAM_CHAT_ID || "",
  minScore: numberFromEnv("MIN_SCORE", app.analysis.minScore),
  lookbackHours: numberFromEnv("LOOKBACK_HOURS", app.analysis.lookbackHours),
  maxVacanciesPerSource: numberFromEnv("MAX_VACANCIES_PER_SOURCE", app.analysis.maxVacanciesPerSource),
  maxAnalysesPerRun: numberFromEnv("MAX_ANALYSES_PER_RUN", app.analysis.maxAnalysesPerRun),
  headless: booleanFromEnv("HEADLESS", app.runtime.headless),
  dataDir: resolvePath(process.env.DATA_DIR, app.runtime.dataDir),
  browserProfileDir: resolvePath(process.env.BROWSER_PROFILE_DIR, app.runtime.browserProfileDir),
  skill: {
    dir: resolvePath(process.env.JOB_FIT_SKILL_DIR, app.skill.dir),
    skillFile: app.skill.skillFile,
    resumeFile: app.skill.resumeFile,
    profileFile: app.skill.profileFile
  }
};

export function resolveSkillFile(relativePath: string): string {
  return path.resolve(config.skill.dir, relativePath);
}
