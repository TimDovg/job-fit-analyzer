import fs from "node:fs";
import path from "node:path";
import process from "node:process";

type Args = {
  name?: string;
  resume?: string;
  search?: string;
  douCategory?: string;
  douUrl?: string;
  minScore?: number;
  lookbackHours?: number;
  telegram?: boolean;
  force: boolean;
  help: boolean;
};

const rootDir = process.cwd();

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  ensureDirectory("config");
  ensureDirectory("candidate/job-fit-analyzer/references");

  copyIfMissing(".env.example", ".env", args.force);
  copyIfMissing("candidate/job-fit-analyzer/references/resume.example.md", "candidate/job-fit-analyzer/references/resume.md", args.force);
  copyIfMissing(
    "candidate/job-fit-analyzer/references/candidate-profile.example.md",
    "candidate/job-fit-analyzer/references/candidate-profile.md",
    args.force
  );

  writeConfig(args);
  writeResume(args);
  writeCandidateProfile(args);

  console.log("Setup complete.");
  console.log("");
  console.log("Created/updated local files:");
  console.log("- .env");
  console.log("- config/job-watch.config.json");
  console.log("- candidate/job-fit-analyzer/references/resume.md");
  console.log("- candidate/job-fit-analyzer/references/candidate-profile.md");
  console.log("");
  console.log("Next:");
  console.log("1. Fill Telegram secrets in .env if Telegram is enabled: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID.");
  console.log("2. Ask your AI assistant to polish resume.md and candidate-profile.md from the candidate CV.");
  console.log("3. Run: npm run doctor");
  console.log("4. Run: npm run login");
  console.log("5. Create a Codex scheduled task using docs/codex-automation-prompt.example.md.");
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
      default:
        throw new Error(`Unknown option: --${rawKey}`);
    }
  }

  return args;
}

function writeConfig(args: Args): void {
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

function writeResume(args: Args): void {
  if (!args.resume) return;

  const sourcePath = path.resolve(args.resume);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Resume file not found: ${sourcePath}`);
  }

  const targetPath = projectPath("candidate/job-fit-analyzer/references/resume.md");
  if (fs.existsSync(targetPath) && !args.force && fs.readFileSync(targetPath, "utf8").trim() !== fs.readFileSync(projectPath("candidate/job-fit-analyzer/references/resume.example.md"), "utf8").trim()) {
    console.log(`Skipped existing resume.md. Use --force to overwrite it from ${sourcePath}.`);
    return;
  }

  const raw = fs.readFileSync(sourcePath);
  const sourceName = path.basename(sourcePath);
  const text = looksBinary(raw)
    ? [
        "# Candidate Resume",
        "",
        `Source file: ${sourcePath}`,
        "",
        "This appears to be a binary resume file. Ask your AI assistant to extract the CV into clean markdown here.",
        "",
        "Keep this file factual: experience, skills, projects, education, languages, and contact/header details."
      ].join("\n")
    : [`# Candidate Resume`, ``, `Source file: ${sourceName}`, ``, raw.toString("utf8").trim(), ``].join("\n");

  fs.writeFileSync(targetPath, text);
}

function writeCandidateProfile(args: Args): void {
  if (!args.name && !args.search) return;

  const targetPath = projectPath("candidate/job-fit-analyzer/references/candidate-profile.md");
  const existing = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, "utf8") : "";
  if (existing.trim() && !isExampleProfile(existing) && !args.force) {
    console.log("Skipped existing candidate-profile.md. Use --force to regenerate the scaffold.");
    return;
  }

  const name = args.name ?? "";
  const search = args.search ?? "the configured target roles";

  const profile = [
    "# Candidate Profile",
    "",
    "This file configures `job-fit-analyzer` for the current candidate. Keep factual CV details in `resume.md`; use this file for positioning, scoring preferences, honest limitations, and reusable application-answer defaults.",
    "",
    "## Summary",
    "",
    `Name: ${name}`,
    "Location: ",
    "Current title: ",
    "Years of experience: ",
    `Preferred roles: ${search}`,
    "Preferred work format: ",
    "Current direction: ",
    "Languages: ",
    "Expected compensation: ",
    "Notice period: ",
    "",
    "## Core Strengths",
    "",
    "- ",
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
    `- ${search}`,
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

function looksBinary(buffer: Buffer): boolean {
  return buffer.subarray(0, 512).includes(0);
}

function isExampleProfile(text: string): boolean {
  return text.includes("### Company / Project, dates") && text.includes("Name:  ");
}

function printHelp(): void {
  console.log(`Usage:
  npm run setup -- --name "Jane Doe" --resume ./resume.md --search "React TypeScript roles"

Options:
  --name <name>              Candidate display name
  --resume <path>            Markdown or text resume to copy into resume.md
  --search <description>     Search/target role description
  --dou-category <category>  DOU category, e.g. "Front End"
  --dou-url <url>            Exact DOU listing URL
  --min-score <number>       Telegram reporting threshold
  --lookback-hours <number>  Vacancy freshness window
  --telegram / --no-telegram Enable or disable Telegram reporting
  --force                    Overwrite existing local config/resume/profile files
`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
