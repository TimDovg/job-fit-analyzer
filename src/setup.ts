import fs from "node:fs";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

type Args = {
  name?: string;
  resume?: string;
  search?: string;
  douCategory?: string;
  douUrl?: string;
  minScore?: number;
  lookbackHours?: number;
  chatId?: string;
  telegram?: boolean;
  force: boolean;
  help: boolean;
};

const rootDir = process.cwd();
const require = createRequire(import.meta.url);
const defaultResumePath = "example_resume.pdf";
const generatedPromptPath = "codex-task-prompt.md";
const telegramBotUsername = "job_fit_analyzer_bot";
const telegramSetupPollMs = 2000;
const telegramSetupTimeoutMs = 5 * 60 * 1000;

type ResumeContent = {
  sourcePath: string;
  sourceName: string;
  text: string;
  extractionNote?: string;
};

type SetupInputs = Args & {
  name: string;
  resume: string;
  search: string;
  chatId?: string;
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const resume = await readResume(args.resume ?? defaultResumePath);
  const inputs = await collectInputs(args, resume);

  ensureDirectory("config");
  ensureDirectory("candidate/job-fit-analyzer/references");

  copyIfMissing(".env.example", ".env", args.force);
  copyIfMissing("candidate/job-fit-analyzer/references/resume.example.md", "candidate/job-fit-analyzer/references/resume.md", args.force);
  copyIfMissing(
    "candidate/job-fit-analyzer/references/candidate-profile.example.md",
    "candidate/job-fit-analyzer/references/candidate-profile.md",
    args.force
  );

  writeConfig(inputs);
  writeEnv(inputs);
  writeResume(resume, args.force);
  writeCandidateProfile(inputs, resume);
  writeCodexPrompt(inputs);

  console.log("Setup complete.");
  console.log("");
  console.log("Created/updated local files:");
  console.log("- .env");
  console.log("- config/job-watch.config.json");
  console.log("- candidate/job-fit-analyzer/references/resume.md");
  console.log("- candidate/job-fit-analyzer/references/candidate-profile.md");
  console.log(`- ${generatedPromptPath}`);
  if ((inputs.telegram ?? true) && !readEnvValue("NOTIFICATION_WEBHOOK_URL") && !readEnvValue("TELEGRAM_BOT_TOKEN")) {
    console.log("");
    console.log("Notification relay is not configured yet.");
    console.log("For the public three-step candidate flow, the repo owner should put NOTIFICATION_WEBHOOK_URL in .env.example before publishing.");
  }
  console.log("");
  console.log("Next:");
  console.log("1. Run: npm run doctor");
  console.log("2. Run: npm run login");
  console.log(`3. Create a Codex scheduled task using ${generatedPromptPath}.`);
}

function parseArgs(argv: string[]): Args {
  const args: Args = { force: false, help: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) continue;

    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }
    if (arg === "--force") {
      args.force = true;
      continue;
    }
    if (arg === "--no-telegram") {
      args.telegram = false;
      continue;
    }
    if (arg === "--telegram") {
      args.telegram = true;
      continue;
    }

    const [rawKey, inlineValue] = arg.startsWith("--") ? arg.slice(2).split("=", 2) : [undefined, undefined];
    if (!rawKey) {
      throw new Error(`Unexpected argument: ${arg}`);
    }
    const value = inlineValue ?? argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${rawKey}`);
    }
    if (inlineValue === undefined) index += 1;

    switch (rawKey) {
      case "name":
        args.name = value;
        break;
      case "resume":
        args.resume = value;
        break;
      case "search":
        args.search = value;
        break;
      case "dou-category":
        args.douCategory = value;
        break;
      case "dou-url":
        args.douUrl = value;
        break;
      case "min-score":
        args.minScore = parseNumber(value, "--min-score");
        break;
      case "lookback-hours":
        args.lookbackHours = parseNumber(value, "--lookback-hours");
        break;
      case "chat-id":
      case "telegram-chat-id":
        args.chatId = value;
        break;
      default:
        throw new Error(`Unknown option: --${rawKey}`);
    }
  }

  return args;
}

async function collectInputs(args: Args, resume: ResumeContent): Promise<SetupInputs> {
  const inferredName = inferName(resume.text);
  const defaults = {
    name: args.name ?? inferredName ?? "Configured Candidate",
    search: args.search ?? "Front End vacancies",
    chatId: args.chatId
  };

  if (!process.stdin.isTTY) {
    return {
      ...args,
      name: defaults.name,
      resume: resume.sourcePath,
      search: defaults.search,
      chatId: defaults.chatId
    };
  }

  const rl = createInterface({ input, output });
  try {
    const name = args.name ?? await askWithDefault(rl, "Candidate name", defaults.name);
    const search = args.search ?? await askWithDefault(rl, "Target roles / search description", defaults.search);
    let chatId = args.chatId;
    if (args.telegram !== false) {
      chatId = chatId ?? await linkTelegramChat();
      if (!chatId) {
        chatId = await askWithDefault(rl, "Telegram chatId from @job_fit_analyzer_bot", defaults.chatId ?? "");
      }
    }

    return {
      ...args,
      name,
      resume: resume.sourcePath,
      search,
      chatId: chatId || undefined
    };
  } finally {
    rl.close();
  }
}

async function askWithDefault(rl: ReturnType<typeof createInterface>, label: string, fallback: string): Promise<string> {
  const suffix = fallback ? ` [${fallback}]` : "";
  const answer = await rl.question(`${label}${suffix}: `);
  return answer.trim() || fallback;
}

async function linkTelegramChat(): Promise<string | undefined> {
  const notificationWebhookUrl = readEnvValue("NOTIFICATION_WEBHOOK_URL");
  const statusUrl = buildSetupStatusUrl(notificationWebhookUrl);
  if (!statusUrl) return undefined;

  const token = crypto.randomBytes(16).toString("hex");
  const setupLink = `https://t.me/${telegramBotUsername}?start=${token}`;
  const tokenStatusUrl = `${statusUrl}/${token}`;

  console.log("");
  console.log("Telegram setup:");
  console.log(`1. Open: ${setupLink}`);
  console.log("2. Press Start in Telegram.");
  console.log("3. Keep this terminal open; setup will continue automatically.");
  console.log("");

  const startedAt = Date.now();
  while (Date.now() - startedAt < telegramSetupTimeoutMs) {
    const chatId = await fetchSetupChatId(tokenStatusUrl);
    if (chatId) {
      console.log(`Telegram connected: ${maskChatId(chatId)}`);
      return chatId;
    }
    await delay(telegramSetupPollMs);
  }

  console.log("Telegram auto-link timed out. You can still paste chatId manually.");
  return undefined;
}

async function fetchSetupChatId(statusUrl: string): Promise<string | undefined> {
  const response = await fetch(statusUrl).catch(() => undefined);
  if (!response?.ok) return undefined;
  const body = await response.json().catch(() => undefined) as { pending?: boolean; chatId?: string } | undefined;
  if (body?.pending === false && body.chatId) return `${body.chatId}`;
  return undefined;
}

function buildSetupStatusUrl(notificationWebhookUrl: string): string {
  if (!notificationWebhookUrl) return "";
  return notificationWebhookUrl.replace(/\/telegram\/?$/, "/setup");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function maskChatId(chatId: string): string {
  if (chatId.length <= 4) return "present";
  return `${chatId.slice(0, 2)}...${chatId.slice(-2)}`;
}

function writeConfig(args: SetupInputs): void {
  const examplePath = projectPath("config/job-watch.config.example.json");
  const configPath = projectPath("config/job-watch.config.json");
  const config = JSON.parse(fs.readFileSync(examplePath, "utf8")) as {
    candidate: { displayName: string; searchDescription: string };
    analysis: { minScore: number; lookbackHours: number };
    sources: { dou: { listingUrl: string; categoryName: string } };
    telegram: { enabled: boolean };
  };

  config.candidate.displayName = args.name ?? config.candidate.displayName;
  config.candidate.searchDescription = args.search ?? config.candidate.searchDescription;
  config.analysis.minScore = args.minScore ?? config.analysis.minScore;
  config.analysis.lookbackHours = args.lookbackHours ?? config.analysis.lookbackHours;
  config.telegram.enabled = args.telegram ?? config.telegram.enabled;

  if (args.douUrl) {
    config.sources.dou.listingUrl = args.douUrl;
  } else if (args.douCategory) {
    config.sources.dou.categoryName = args.douCategory;
    config.sources.dou.listingUrl = `https://jobs.dou.ua/vacancies/?category=${encodeURIComponent(args.douCategory)}&from=maybe`;
  }

  writeJsonIfAllowed(configPath, config, args.force);
}

function writeEnv(args: SetupInputs): void {
  const envPath = projectPath(".env");
  const env = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : fs.readFileSync(projectPath(".env.example"), "utf8");
  const updates: Record<string, string> = {};
  if (args.chatId) updates.TELEGRAM_CHAT_ID = args.chatId;

  fs.writeFileSync(envPath, updateEnv(env, updates));
}

function writeResume(resume: ResumeContent, force: boolean): void {
  const targetPath = projectPath("candidate/job-fit-analyzer/references/resume.md");
  if (fs.existsSync(targetPath) && !force && fs.readFileSync(targetPath, "utf8").trim() !== fs.readFileSync(projectPath("candidate/job-fit-analyzer/references/resume.example.md"), "utf8").trim()) {
    console.log(`Skipped existing resume.md. Use --force to overwrite it from ${resume.sourcePath}.`);
    return;
  }

  const text = [
    "# Candidate Resume",
    "",
    `Source file: ${resume.sourceName}`,
    resume.extractionNote ? `Extraction note: ${resume.extractionNote}` : "",
    "",
    resume.text.trim(),
    ""
  ].filter(Boolean).join("\n");

  fs.writeFileSync(targetPath, text);
}

function writeCandidateProfile(args: SetupInputs, resume: ResumeContent): void {
  const targetPath = projectPath("candidate/job-fit-analyzer/references/candidate-profile.md");
  const existing = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, "utf8") : "";
  if (existing.trim() && !isExampleProfile(existing) && !args.force) {
    console.log("Skipped existing candidate-profile.md. Use --force to regenerate the scaffold.");
    return;
  }

  const keywords = detectKeywords(resume.text);

  const profile = [
    "# Candidate Profile",
    "",
    "This file configures `job-fit-analyzer` for the current candidate. Keep factual CV details in `resume.md`; use this file for positioning, scoring preferences, honest limitations, and reusable application-answer defaults.",
    "",
    "## Summary",
    "",
    `Name: ${args.name}`,
    "Location: ",
    "Current title: ",
    "Years of experience: ",
    `Preferred roles: ${args.search}`,
    "Preferred work format: ",
    "Current direction: ",
    "Languages: ",
    "Expected compensation: ",
    "Notice period: ",
    "",
    "## Core Strengths",
    "",
    ...(keywords.length > 0 ? keywords.map((keyword) => `- ${keyword}`) : ["- "]),
    "",
    "## Work Experience Positioning",
    "",
    "### Company / Project, dates",
    "",
    "Relevant work:",
    "- ",
    "",
    "Strong interview or application story:",
    "",
    "## Preferred Roles / Higher Score",
    "",
    "Give higher scores for roles involving:",
    `- ${args.search}`,
    "",
    "## Weak Fits / Lower Score",
    "",
    "Give lower scores for roles mainly involving:",
    "- ",
    "",
    "## Honest Limitations",
    "",
    "Do not overclaim these as strong commercial experience:",
    "- ",
    "",
    "## Positioning Notes",
    "",
    "For strongest target roles:",
    "",
    "For stretch roles:",
    "",
    "For leadership roles:",
    "",
    "For domain-specific roles:",
    "",
    "## Common Short Answers",
    "",
    "- English level:",
    "- Notice period:",
    "- Expected compensation:",
    "- Work authorization:",
    "- Relocation/office preference:",
    ""
  ].join("\n");

  fs.writeFileSync(targetPath, profile);
}

function writeCodexPrompt(args: SetupInputs): void {
  const templatePath = projectPath("docs/codex-automation-prompt.example.md");
  const outputPath = projectPath(generatedPromptPath);
  const template = fs.readFileSync(templatePath, "utf8");
  const replacements: Record<string, string> = {
    PROJECT_DIR: rootDir,
    CANDIDATE_NAME: args.name,
    SEARCH_DESCRIPTION: args.search,
    SKILL_PATH: projectPath("candidate/job-fit-analyzer/SKILL.md"),
    STATE_PATH: projectPath("data/chatgpt-scheduled-state.json"),
    NOTIFICATION_WEBHOOK_URL: readEnvValue("NOTIFICATION_WEBHOOK_URL"),
    TELEGRAM_CHAT_ID: args.chatId ?? ""
  };

  const prompt = Object.entries(replacements).reduce(
    (current, [key, value]) => current.replaceAll(`{{${key}}}`, value),
    template
  );

  fs.writeFileSync(outputPath, prompt);
}

function copyIfMissing(from: string, to: string, force: boolean): void {
  const sourcePath = projectPath(from);
  const targetPath = projectPath(to);
  if (fs.existsSync(targetPath) && !force) return;
  fs.copyFileSync(sourcePath, targetPath);
}

function writeJsonIfAllowed(filePath: string, value: unknown, force: boolean): void {
  if (fs.existsSync(filePath) && !force) {
    console.log(`Skipped existing ${path.relative(rootDir, filePath)}. Use --force to overwrite it.`);
    return;
  }
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function updateEnv(text: string, updates: Record<string, string>): string {
  const lines = text.split(/\r?\n/);
  const seen = new Set<string>();
  const updated = lines.map((line) => {
    const match = line.match(/^([A-Z0-9_]+)=/);
    if (!match) return line;
    const key = match[1];
    if (!key || !(key in updates)) return line;
    seen.add(key);
    return `${key}=${updates[key]}`;
  });

  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) updated.push(`${key}=${value}`);
  }

  return `${updated.join("\n").replace(/\n+$/, "")}\n`;
}

function readEnvValue(key: string): string {
  const envPath = projectPath(".env");
  const candidates = [
    fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "",
    fs.readFileSync(projectPath(".env.example"), "utf8")
  ];

  for (const text of candidates) {
    const match = text.match(new RegExp(`^${key}=(.*)$`, "m"));
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

function ensureDirectory(relativePath: string): void {
  fs.mkdirSync(projectPath(relativePath), { recursive: true });
}

function projectPath(relativePath: string): string {
  return path.resolve(rootDir, relativePath);
}

function parseNumber(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a number`);
  }
  return parsed;
}

function isExampleProfile(text: string): boolean {
  return text.includes("### Company / Project, dates") && text.includes("Name:  ");
}

async function readResume(rawPath: string): Promise<ResumeContent> {
  const sourcePath = path.resolve(rawPath);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Resume file not found: ${sourcePath}. Replace ${defaultResumePath} with your resume PDF, or pass --resume /path/to/resume.md.`);
  }

  const raw = fs.readFileSync(sourcePath);
  const sourceName = path.basename(sourcePath);
  const extension = path.extname(sourceName).toLowerCase();

  if (extension === ".pdf") {
    const text = await extractPdfText(raw);
    return {
      sourcePath,
      sourceName,
      text,
      extractionNote: "Extracted automatically from PDF by npm run setup."
    };
  }

  return {
    sourcePath,
    sourceName,
    text: raw.toString("utf8")
  };
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfParse = require("pdf-parse") as (input: Buffer) => Promise<{ text?: string }>;
  const result = await pdfParse(buffer);
  const text = normalizeResumeText(result.text ?? "");
  if (!text) {
    throw new Error("Could not extract text from example_resume.pdf. Try exporting the resume as text/markdown and pass --resume ./resume.md.");
  }
  return text;
}

function inferName(text: string): string | undefined {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /^[A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){1,3}$/.test(line));
}

function detectKeywords(text: string): string[] {
  const known: Array<[string, RegExp]> = [
    ["React", /\bReact\b/i],
    ["TypeScript", /\bTypeScript\b/i],
    ["JavaScript", /\bJavaScript\b/i],
    ["Node.js", /\bNode(?:\.js|JS)?\b/i],
    ["Next.js", /\bNext(?:\.js|JS)?\b/i],
    ["Vue", /\bVue\b/i],
    ["Angular", /\bAngular\b/i],
    ["Python", /\bPython\b/i],
    ["Java", /\bJava\b/i],
    [".NET", /\.NET\b/i],
    ["PHP", /\bPHP\b/i],
    ["Go", /\bGolang\b|\bGo\b/i],
    ["Ruby", /\bRuby\b/i],
    ["Firebase", /\bFirebase\b/i],
    ["GCP", /\bGCP\b|\bGoogle Cloud\b/i],
    ["AWS", /\bAWS\b|\bAmazon Web Services\b/i],
    ["PostgreSQL", /\bPostgreSQL\b|\bPostgres\b/i],
    ["MySQL", /\bMySQL\b/i],
    ["MongoDB", /\bMongoDB\b/i],
    ["GraphQL", /\bGraphQL\b/i],
    ["REST", /\bREST\b/i],
    ["Jest", /\bJest\b/i],
    ["Cypress", /\bCypress\b/i],
    ["Playwright", /\bPlaywright\b/i],
    ["Docker", /\bDocker\b/i],
    ["Kubernetes", /\bKubernetes\b|\bK8s\b/i],
    ["AI", /\bAI\b|\bArtificial Intelligence\b/i],
    ["LLM", /\bLLM\b|\bLarge Language Model/i]
  ];
  return known.filter(([, pattern]) => pattern.test(text)).map(([keyword]) => keyword).slice(0, 16);
}

function normalizeResumeText(text: string): string {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function printHelp(): void {
  console.log(`Usage:
  npm run setup
  npm run setup -- --chat-id 123456789

Options:
  --name <name>              Candidate display name
  --resume <path>            Resume PDF, markdown, or text file. Defaults to ./example_resume.pdf
  --search <description>     Search/target role description
  --dou-category <category>  DOU category, e.g. "Front End"
  --dou-url <url>            Exact DOU listing URL
  --min-score <number>       Telegram reporting threshold
  --lookback-hours <number>  Vacancy freshness window
  --chat-id <id>             Manual Telegram chatId fallback
  --telegram / --no-telegram Enable or disable Telegram reporting
  --force                    Overwrite existing local config/resume/profile files
`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
