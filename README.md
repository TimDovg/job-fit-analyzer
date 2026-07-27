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
  -> telegram:send calls a private notification relay
  -> relay holds TELEGRAM_BOT_TOKEN and calls Telegram Bot API
  -> relay stores one-time Telegram setup links in Render Key Value
```

The candidate is configured through files, not hardcoded in source code:

- `config/job-watch.config.json` controls search sources, limits, score threshold, paths, and runtime behavior.
- `candidate/job-fit-analyzer/references/resume.md` is the full factual CV.
- `candidate/job-fit-analyzer/references/candidate-profile.md` is the positioning guide for scoring and application text.
- `.env` contains the auto-linked candidate chat id and the public notification relay URL.

## Quick Start

Human setup is intentionally small:

1. Replace `example_resume.pdf` with your own resume PDF.
2. Run `npm run setup`.
3. Open the Telegram link shown by setup and press Start.

```bash
npm install
npm run setup
```

The setup command creates local, gitignored files:

- `.env` with your auto-linked `TELEGRAM_CHAT_ID`
- `config/job-watch.config.json`
- `candidate/job-fit-analyzer/references/resume.md`
- `candidate/job-fit-analyzer/references/candidate-profile.md`
- `codex-task-prompt.md`

`codex-task-prompt.md` is generated locally and intentionally ignored by git because it contains local paths and candidate-specific values. You will not see it in GitHub before running setup.

Then run:

```bash
npm run doctor
npm run login
```

`npm run setup` installs the required Playwright Chromium browser after setup. `npm run login` also checks/install it before opening Djinni, so a fresh Windows clone does not need a separate browser-install command.
If a network or cache issue interrupts that install, run `npm run install-browsers` once and retry `npm run login`.

Finally, create a Codex scheduled task using the generated `codex-task-prompt.md`.

## One-Command Candidate Setup

Default happy path:

1. Replace `example_resume.pdf` with the candidate resume PDF.
2. Run `npm run setup`.
3. Open the Telegram setup link shown in the terminal.

`npm run setup` only reads `example_resume.pdf`. It extracts the resume, infers the candidate name and target category, opens a one-time Telegram linking flow through `@job_fit_analyzer_bot`, creates local config/profile files, and generates `codex-task-prompt.md`.

For this to stay a no-copy chatId flow, the repo owner should deploy the private notification relay with Render Key Value and put its public, non-secret `/telegram` URL into `.env.example` as `NOTIFICATION_WEBHOOK_URL`.

For non-interactive setup or fallback, pass the chat id directly:

```bash
npm run setup -- --chat-id 123456789
```

Setup flags:

- `--chat-id`: manual Telegram chatId fallback.
- `--no-telegram`: keep reports in the Codex task only.
- `--force`: overwrite existing local setup files.

## Generated Candidate Files

`npm run setup` creates candidate files from `example_resume.pdf`. You usually do not edit these before the first run.

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

The Codex task should treat `resume.md` as source of truth and `candidate-profile.md` as scoring/tone guidance. Edit these files only when the PDF extraction missed something important or the candidate wants deliberate positioning changes.

## Main Config

`npm run setup` creates `config/job-watch.config.json` automatically. Edit it only when the inferred defaults need deliberate tuning.

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

Environment variables in `.env` override selected config values only for advanced local runs.

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

For the public candidate project, `npm run telegram:send` should use `NOTIFICATION_WEBHOOK_URL`.

`TELEGRAM_BOT_TOKEN` must live only on the private notification relay, never in the public repository and never in candidate setup files.

## Private Notification Relay

### Deploy On Render

The repo includes `render.yaml` for Render Blueprint deployment.

1. In Render, create a new Blueprint from this GitHub repository.
2. When Render asks for environment variables, set:
   - `TELEGRAM_BOT_TOKEN`: shared bot token from BotFather.
   - `TELEGRAM_WEBHOOK_SECRET`: random secret used only by Telegram webhook requests.
3. Deploy the service and the `job-fit-setup-links` Key Value instance from `render.yaml`.
4. Open `/health` on the deployed URL and expect `{"ok":true}`.
5. Register the bot webhook once:

```bash
TELEGRAM_WEBHOOK_URL=https://job-fit-notification-relay.onrender.com/telegram/webhook \
npm run telegram:set-webhook
```

Run this from a shell that already has `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` set locally. Do not commit those values.

For an already deployed Render service, add `TELEGRAM_WEBHOOK_SECRET` manually in the service's Environment settings, then redeploy.

For an already deployed Blueprint, sync the Blueprint so Render creates `job-fit-setup-links` and wires `REDIS_URL` into the relay service. If you do not use Blueprint sync, create a Render Key Value instance manually and add its internal connection string to the relay service as `REDIS_URL`.

6. Put the relay endpoint into `.env.example`:

```env
NOTIFICATION_WEBHOOK_URL=https://job-fit-notification-relay.onrender.com/telegram
```

One-time owner setup:

1. Deploy this project somewhere private/server-side.
2. Set `TELEGRAM_BOT_TOKEN` in that platform's secrets/env.
3. Run `npm run relay`.
4. Put the public relay endpoint into this repo's `.env.example`:

```env
NOTIFICATION_WEBHOOK_URL=https://job-fit-notification-relay.onrender.com/telegram
```

Run this only in the private environment controlled by the shared bot owner:

```bash
npm run relay
```

Set `TELEGRAM_BOT_TOKEN` in the deployment platform's private environment before starting it.

The relay exposes:

- `GET /health`
- `GET /setup/:token`
- `POST /telegram`
- `POST /telegram/webhook`

`GET /setup/:token` is used by `npm run setup` while it waits for Telegram linking. `POST /telegram/webhook` is for Telegram itself. After webhook registration, `@job_fit_analyzer_bot` responds to `/start` with the user's chatId and to `/start <setup-token>` by linking Telegram automatically to the setup process.

Do not add `TELEGRAM_WEBHOOK_SECRET` to the candidate `.env.example`; it belongs only in Render and in the one-time webhook registration command.

Candidate setup stores the linked chat id in `.env`, then scheduled tasks send to `NOTIFICATION_WEBHOOK_URL`, for example:

```env
NOTIFICATION_WEBHOOK_URL=https://job-fit-notification-relay.onrender.com/telegram
TELEGRAM_CHAT_ID=123456789
```

Optional hardening for the relay owner only: set `NOTIFICATION_RELAY_SECRET` on the relay and `NOTIFICATION_WEBHOOK_SECRET` only in trusted sender environments. Do not put these in the candidate `.env.example`.

For public usage, keep rate limiting/allowlisting on the relay side and commit only the non-secret `NOTIFICATION_WEBHOOK_URL` default into `.env.example`.

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

Give an AI assistant this repo plus the candidate PDF resume and ask it to follow `AGENTS.md`. The intended flow is:

1. Replace `example_resume.pdf`.
2. Run `npm run setup` and open the Telegram setup link.
3. Review generated `resume.md`, `candidate-profile.md`, and config only for obvious extraction/inference issues.
4. Run `npm run doctor` and `npm run login`.
5. Create the Codex scheduled task from `codex-task-prompt.md`.
