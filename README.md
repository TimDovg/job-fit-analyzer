# Job Watch Agent

Candidate-agnostic vacancy watcher for Djinni and DOU.

The project collects recent vacancies, analyzes each vacancy against a configured candidate resume/profile, stores analyzed URLs to avoid duplicates, and sends matching results to Telegram.

## Architecture

```text
Playwright collectors -> vacancy details -> job-fit analyzer prompt -> OpenAI analysis -> local store -> Telegram
```

The candidate is configured through files, not hardcoded in source code:

- `config/job-watch.config.json` controls search sources, limits, score threshold, paths, and runtime behavior.
- `candidate/job-fit-analyzer/references/resume.md` is the full factual CV.
- `candidate/job-fit-analyzer/references/candidate-profile.md` is the positioning guide for scoring and application text.
- `.env` contains only secrets and optional environment overrides.

## Quick Start

```bash
npm install
npm run install-browsers
npm run setup -- --name "Your Name" --resume /path/to/resume.md --search "React TypeScript roles" --dou-category "Front End"
```

The setup command creates local, gitignored files:

- `.env`
- `config/job-watch.config.json`
- `candidate/job-fit-analyzer/references/resume.md`
- `candidate/job-fit-analyzer/references/candidate-profile.md`

Fill `.env` secrets:

```bash
OPENAI_API_KEY=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

Run:

```bash
npm run doctor
npm run login
npm run check
```

## Configure A Candidate

The easiest path is:

```bash
npm run setup -- --name "Jane Doe" --resume ./jane-resume.md --search "Senior Frontend / Full-stack TypeScript roles" --dou-category "Front End" --min-score 6
```

Useful setup flags:

- `--name`: candidate display name.
- `--resume`: markdown or text resume path. For PDFs, ask an AI assistant to convert the PDF to markdown first.
- `--search`: target role description used in config and profile scaffold.
- `--dou-category`: DOU category name.
- `--dou-url`: exact DOU listing URL if category is not enough.
- `--min-score`: Telegram reporting threshold.
- `--lookback-hours`: vacancy freshness window.
- `--max-analyses`: OpenAI spending guardrail per run.
- `--model`: OpenAI model for the local `npm run check` path.
- `--no-telegram`: keep reports in logs only.
- `--force`: overwrite existing local setup files.

Use `resume.md` for facts:

- contact/header details;
- summary;
- skills;
- experience;
- projects;
- education;
- languages.

Use `candidate-profile.md` for judgment and positioning:

- preferred roles;
- strongest stacks/domains;
- weak fits and honest limitations;
- compensation and notice period;
- application-answer defaults;
- specific stories worth mentioning.

The analyzer treats `resume.md` as source of truth and `candidate-profile.md` as scoring/tone guidance.

## Main Config

Edit `config/job-watch.config.json`.

Important fields:

- `candidate.displayName`: candidate name for logs and prompts.
- `candidate.searchDescription`: human label for the monitored search.
- `analysis.minScore`: Telegram reporting threshold.
- `analysis.lookbackHours`: only collect recently published vacancies.
- `analysis.maxVacanciesPerSource`: collection cap per source.
- `analysis.maxAnalysesPerRun`: OpenAI API spending guardrail.
- `skill.dir`: analyzer prompt directory.
- `skill.resumeFile`: resume path relative to `skill.dir`.
- `skill.profileFile`: candidate profile path relative to `skill.dir`.
- `sources.djinni.dashboardUrl`: Djinni dashboard URL.
- `sources.dou.listingUrl`: DOU listing URL, including category query.
- `telegram.enabled`: whether matching results should be sent.

Environment variables in `.env` override selected config values when set.

## Login

Djinni requires a logged-in browser session. Run:

```bash
npm run login
```

Log in to Djinni in the opened browser window. DOU is public, but the login command opens it too so the browser profile is warmed up.

The browser session is stored in `browser-profile/`, which is ignored by git.

## Manual Check

```bash
npm run check
```

Every run:

1. Opens configured Djinni and DOU pages with a persistent Playwright browser profile.
2. Collects vacancies published within `analysis.lookbackHours`.
3. Skips vacancies already analyzed with the same content hash.
4. Analyzes up to `analysis.maxAnalysesPerRun` vacancies against the configured resume/profile.
5. Sends Telegram messages only for vacancies with score `analysis.minScore` or higher.

## Send A Prepared Telegram Message

This command only sends a text file through the Telegram bot. It does not call OpenAI.

```bash
npm run telegram:send -- /tmp/vacancy-report.txt
```

## macOS launchd

```bash
chmod +x scripts/install-launchd.sh
./scripts/install-launchd.sh
```

The install script writes an absolute-path launchd plist from `config/com.openai.job-watch-agent.plist.example`.

Logs are written to:

```text
data/launchd.out.log
data/launchd.err.log
```

## Public Repo Notes

Safe to commit:

- source files;
- `config/job-watch.config.example.json`;
- `candidate/job-fit-analyzer/SKILL.md`;
- `candidate/job-fit-analyzer/references/*.example.md`;
- `.env.example`.

Do not commit:

- `.env`;
- `config/job-watch.config.json`;
- `candidate/job-fit-analyzer/references/resume.md`;
- `candidate/job-fit-analyzer/references/candidate-profile.md`;
- `data/`;
- `browser-profile/`;
- `node_modules/`.

## AI-Assisted Setup

Give an AI assistant this repo plus the candidate resume and ask it to follow `AGENTS.md`. The intended flow is:

1. Run `npm run setup -- --name "..." --resume ./resume.md --search "..."`.
2. Polish `resume.md` and `candidate-profile.md`.
3. Fill `.env` placeholders manually for secrets.
4. Run `npm run doctor`, `npm run login`, and `npm run check`.

For Codex scheduled tasks that should use the current Codex model instead of the local OpenAI API path, use `docs/codex-automation-prompt.example.md`.
