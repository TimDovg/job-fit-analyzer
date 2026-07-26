# Job Fit Analyzer

Codex-first vacancy watcher for Djinni and DOU.

This project is a reusable setup package for a Codex scheduled task. Codex does the vacancy collection and analysis with the current Codex/ChatGPT model; this repo provides the candidate configuration, job-fit skill, browser login profile, state conventions, and Telegram sender.

## Architecture

```text
Codex scheduled task
  -> reads config/job-watch.config.json
  -> opens Djinni/DOU with Playwright/browser profile when needed
  -> reads candidate/job-fit-analyzer/SKILL.md
  -> reads resume.md + candidate-profile.md
  -> analyzes vacancies with the current Codex model
  -> writes report text
  -> uses npm run telegram:send for Telegram delivery
```

The candidate is configured through files, not hardcoded in source code:

- `config/job-watch.config.json` controls search sources, limits, score threshold, paths, and runtime behavior.
- `candidate/job-fit-analyzer/references/resume.md` is the full factual CV.
- `candidate/job-fit-analyzer/references/candidate-profile.md` is the positioning guide for scoring and application text.
- `.env` contains Telegram secrets and optional path/runtime overrides.

## Quick Start

Human setup is intentionally only three steps:

1. Replace `example_resume.pdf` with your own resume PDF.
2. Get your Telegram `chatId` from the shared bot.
3. Run `npm run setup`.

```bash
npm install
npm run install-browsers
npm run setup
```

The setup command creates local, gitignored files:

- `.env` with your `TELEGRAM_CHAT_ID`
- `config/job-watch.config.json`
- `candidate/job-fit-analyzer/references/resume.md`
- `candidate/job-fit-analyzer/references/candidate-profile.md`
- `codex-task-prompt.md`

Then run:

```bash
npm run doctor
npm run login
```

Finally, create a Codex scheduled task using the generated `codex-task-prompt.md`.

## One-Command Candidate Setup

Default happy path:

1. Replace `example_resume.pdf` with the candidate resume PDF.
2. Get the candidate's Telegram `chatId` from the shared bot.
3. Run `npm run setup`.

`npm run setup` will extract the resume, ask for missing values, create local config/profile files, and generate `codex-task-prompt.md`.

For non-interactive setup, pass the chat id directly:

```bash
npm run setup -- --chat-id 123456789
```

Useful setup flags:

- `--name`: candidate display name.
- `--resume`: resume PDF, markdown, or text path. Defaults to `./example_resume.pdf`.
- `--search`: target role description used in config and profile scaffold.
- `--dou-category`: DOU category name.
- `--dou-url`: exact DOU listing URL if category is not enough.
- `--min-score`: reporting threshold.
- `--lookback-hours`: vacancy freshness window.
- `--chat-id`: Telegram chatId from the shared bot.
- `--no-telegram`: keep reports in the Codex task only.
- `--force`: overwrite existing local setup files.

## Configure A Candidate

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

The Codex task should treat `resume.md` as source of truth and `candidate-profile.md` as scoring/tone guidance.

## Main Config

Edit `config/job-watch.config.json`.

Important fields:

- `candidate.displayName`: candidate name for logs and prompts.
- `candidate.searchDescription`: human label for the monitored search.
- `analysis.minScore`: reporting threshold.
- `analysis.lookbackHours`: only collect recently published vacancies.
- `analysis.maxVacanciesPerSource`: collection cap per source.
- `skill.dir`: analyzer skill directory.
- `skill.resumeFile`: resume path relative to `skill.dir`.
- `skill.profileFile`: candidate profile path relative to `skill.dir`.
- `sources.djinni.dashboardUrl`: Djinni dashboard URL.
- `sources.dou.listingUrl`: DOU listing URL, including category query.
- `telegram.enabled`: whether matching results should be sent through Telegram.

Environment variables in `.env` override selected config values when set.

## Login

Djinni requires a logged-in browser session. Run:

```bash
npm run login
```

Log in to Djinni in the opened browser window. DOU is public, but the login command opens it too so the browser profile is warmed up.

The browser session is stored in `browser-profile/`, which is ignored by git.

## Telegram Sender

This command only sends a text file through the Telegram bot. It does not call OpenAI.

```bash
npm run telegram:send -- /tmp/vacancy-report.txt
```

The Codex scheduled task prompt uses this command after it has already produced the final report text.

The shared bot token should be provided by the owner of the shared bot or the Codex scheduled task environment. Do not publish a bot token in the repository.

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

1. Replace `example_resume.pdf` and run `npm run setup`.
2. Polish `resume.md` and `candidate-profile.md`.
3. Fill Telegram secrets in `.env` if needed.
4. Run `npm run doctor` and `npm run login`.
5. Create the Codex scheduled task from `codex-task-prompt.md`.
