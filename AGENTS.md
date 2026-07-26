# AI Setup Instructions

Use these instructions when configuring this project for a new candidate and resume.

## Goal

Make the vacancy watcher usable for a candidate without hardcoding personal data in source files. Keep secrets and private resume data out of git by default.

## Files To Create Locally

Prefer the one-command setup path:

```bash
npm run setup
```

Before setup, the user should replace `example_resume.pdf` with the candidate resume PDF. `npm run setup` will generate a one-time `@job_fit_analyzer_bot` link and auto-fill `TELEGRAM_CHAT_ID`.

The human-facing setup contract is:

1. Replace `example_resume.pdf`.
2. Run `npm run setup`.
3. Open the Telegram setup link shown in the terminal.

Use `--force` only when the user explicitly wants to overwrite existing local candidate files.

Do not commit the created `.env`, `config/job-watch.config.json`, `resume.md`, or `candidate-profile.md` unless the user explicitly wants to publish their own candidate data.

## Candidate Configuration Workflow

1. Read the candidate resume or source materials supplied by the user.
2. Ensure `example_resume.pdf` has been replaced with the candidate resume PDF, or use `--resume /path/to/resume`.
3. Run `npm run setup`, answer any interactive questions, and open the Telegram setup link when prompted. In non-interactive mode or fallback, pass `--chat-id`.
4. Fill or polish `candidate/job-fit-analyzer/references/resume.md` with a complete factual CV in markdown.
5. Fill or polish `candidate/job-fit-analyzer/references/candidate-profile.md` with positioning guidance:
   - target roles;
   - preferred domains and work format;
   - strongest technologies;
   - weaker technologies or domains;
   - things not to overclaim;
   - compensation, notice period, language level, relocation/office preferences;
   - strong project stories for application text.
6. Update `config/job-watch.config.json` if the setup flags were not enough:
   - `candidate.displayName`;
   - `candidate.searchDescription`;
   - DOU category/listing URL;
   - score threshold and per-run limits;
   - `skill.dir`, `skill.resumeFile`, and `skill.profileFile` only if the candidate files are stored somewhere else.
7. Ensure the candidate's `.env` contains the auto-linked `TELEGRAM_CHAT_ID` and a non-secret `NOTIFICATION_WEBHOOK_URL`.
   The shared `TELEGRAM_BOT_TOKEN` must live only on the private notification relay, never in candidate files.
   Do not add relay-owner variables such as `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `NOTIFICATION_RELAY_SECRET`, or `NOTIFICATION_WEBHOOK_SECRET` to the candidate `.env.example`.
8. Run `npm run doctor`.
9. Run `npm run login` so the user can authenticate Djinni in the Playwright browser profile.
10. Create or update a Codex scheduled task using generated `codex-task-prompt.md`.
11. Inspect the first scheduled task run for honesty and score calibration.

## Refactoring Rules

- Do not put candidate-specific facts in `src/`.
- Do not put secrets in `config/job-watch.config.json`.
- Keep `.env` for secrets and optional overrides only.
- Keep `SKILL.md` generic; all candidate-specific scoring must live in `candidate-profile.md`.
- Do not add a standalone local model/API analysis path; this project is intentionally Codex scheduled task only.
- Do not put `TELEGRAM_BOT_TOKEN` in the public candidate project. Use the notification relay for shared-bot delivery.
- If source sites change HTML, update the Codex automation prompt or source config, not candidate files.

## Public Export Checklist

Before publishing to GitHub:

- Ensure `.env` is absent.
- Ensure `codex-task-prompt.md` is absent.
- Ensure `config/job-watch.config.json` is absent.
- Ensure `candidate/job-fit-analyzer/references/resume.md` is absent.
- Ensure `candidate/job-fit-analyzer/references/candidate-profile.md` is absent.
- Ensure `data/`, `browser-profile/`, and `node_modules/` are absent.
- Run `npm run build`.
- Run `rg -n "Tymo[f]ii|Dov[h]opol|TELEGRAM_BOT_TOKEN[=].+|NOTIFICATION_WEBHOOK_SECRET[=].+" . --glob '!node_modules/**' --glob '!data/**' --glob '!browser-profile/**'`.
- Run `rg -n "$HOME" . --glob '!node_modules/**' --glob '!data/**' --glob '!browser-profile/**'`.
- Remove any private leftovers.
