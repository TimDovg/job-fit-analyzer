# AI Setup Instructions

Use these instructions when configuring this project for a new candidate and resume.

## Goal

Make the vacancy watcher usable for a candidate without hardcoding personal data in source files. Keep secrets and private resume data out of git by default.

## Files To Create Locally

Create these files from examples if they do not exist:

```bash
cp .env.example .env
cp config/job-watch.config.example.json config/job-watch.config.json
cp candidate/job-fit-analyzer/references/resume.example.md candidate/job-fit-analyzer/references/resume.md
cp candidate/job-fit-analyzer/references/candidate-profile.example.md candidate/job-fit-analyzer/references/candidate-profile.md
```

Do not commit the created `.env`, `config/job-watch.config.json`, `resume.md`, or `candidate-profile.md` unless the user explicitly wants to publish their own candidate data.

## Candidate Configuration Workflow

1. Read the candidate resume or source materials supplied by the user.
2. Fill `candidate/job-fit-analyzer/references/resume.md` with a complete factual CV in markdown.
3. Fill `candidate/job-fit-analyzer/references/candidate-profile.md` with positioning guidance:
   - target roles;
   - preferred domains and work format;
   - strongest technologies;
   - weaker technologies or domains;
   - things not to overclaim;
   - compensation, notice period, language level, relocation/office preferences;
   - strong project stories for application text.
4. Update `config/job-watch.config.json`:
   - `candidate.displayName`;
   - `candidate.searchDescription`;
   - DOU category/listing URL;
   - score threshold and per-run limits;
   - `skill.dir`, `skill.resumeFile`, and `skill.profileFile` only if the candidate files are stored somewhere else.
5. Ask the user to fill `.env` secrets manually:
   - `OPENAI_API_KEY`;
   - `TELEGRAM_BOT_TOKEN`;
   - `TELEGRAM_CHAT_ID`.
6. Run `npm run doctor`.
7. Run `npm run login` so the user can authenticate Djinni in the Playwright browser profile.
8. Run `npm run check` and inspect the first analysis for honesty and score calibration.

## Refactoring Rules

- Do not put candidate-specific facts in `src/`.
- Do not put secrets in `config/job-watch.config.json`.
- Keep `.env` for secrets and optional overrides only.
- Keep `SKILL.md` generic; all candidate-specific scoring must live in `candidate-profile.md`.
- If source sites change HTML, update only collectors or source config, not candidate files.

## Public Export Checklist

Before publishing to GitHub:

- Ensure `.env` is absent.
- Ensure `config/job-watch.config.json` is absent.
- Ensure `candidate/job-fit-analyzer/references/resume.md` is absent.
- Ensure `candidate/job-fit-analyzer/references/candidate-profile.md` is absent.
- Ensure `data/`, `browser-profile/`, and `node_modules/` are absent.
- Run `npm run build`.
- Run `rg -n "Tymo[f]ii|Dov[h]opol|TELEGRAM_BOT_TOKEN=.+|OPENAI_API_KEY=.+" . --glob '!node_modules/**' --glob '!data/**' --glob '!browser-profile/**'`.
- Run `rg -n "$HOME" . --glob '!node_modules/**' --glob '!data/**' --glob '!browser-profile/**'`.
- Remove any private leftovers.
