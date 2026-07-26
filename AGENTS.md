# AI Setup Instructions

Use these instructions when configuring this project for a new candidate and resume.

## Goal

Make the vacancy watcher usable for a candidate without hardcoding personal data in source files. Keep secrets and private resume data out of git by default.

## Files To Create Locally

Prefer the one-command setup path:

```bash
npm run setup -- --name "Candidate Name" --resume /path/to/resume.md --search "Target roles" --dou-category "Front End"
```

Use `--force` only when the user explicitly wants to overwrite existing local candidate files.

Do not commit the created `.env`, `config/job-watch.config.json`, `resume.md`, or `candidate-profile.md` unless the user explicitly wants to publish their own candidate data.

## Candidate Configuration Workflow

1. Read the candidate resume or source materials supplied by the user.
2. If the resume is a PDF or DOCX, convert it to clean markdown first, then pass that markdown file to `npm run setup -- --resume`.
3. Run `npm run setup -- --name "..." --resume /path/to/resume.md --search "..."`.
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
7. Ask the user to fill `.env` Telegram secrets manually if Telegram is enabled:
   - `TELEGRAM_BOT_TOKEN`;
   - `TELEGRAM_CHAT_ID`.
8. Run `npm run doctor`.
9. Run `npm run login` so the user can authenticate Djinni in the Playwright browser profile.
10. Create or update a Codex scheduled task using `docs/codex-automation-prompt.example.md`.
11. Inspect the first scheduled task run for honesty and score calibration.

## Refactoring Rules

- Do not put candidate-specific facts in `src/`.
- Do not put secrets in `config/job-watch.config.json`.
- Keep `.env` for secrets and optional overrides only.
- Keep `SKILL.md` generic; all candidate-specific scoring must live in `candidate-profile.md`.
- Do not add a standalone local model/API analysis path; this project is intentionally Codex scheduled task only.
- If source sites change HTML, update the Codex automation prompt or source config, not candidate files.

## Public Export Checklist

Before publishing to GitHub:

- Ensure `.env` is absent.
- Ensure `config/job-watch.config.json` is absent.
- Ensure `candidate/job-fit-analyzer/references/resume.md` is absent.
- Ensure `candidate/job-fit-analyzer/references/candidate-profile.md` is absent.
- Ensure `data/`, `browser-profile/`, and `node_modules/` are absent.
- Run `npm run build`.
- Run `rg -n "Tymo[f]ii|Dov[h]opol|TELEGRAM_BOT_TOKEN=.+" . --glob '!node_modules/**' --glob '!data/**' --glob '!browser-profile/**'`.
- Run `rg -n "$HOME" . --glob '!node_modules/**' --glob '!data/**' --glob '!browser-profile/**'`.
- Remove any private leftovers.
