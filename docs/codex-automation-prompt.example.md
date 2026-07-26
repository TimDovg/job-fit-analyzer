# Codex Automation Prompt Template

Use this prompt when creating a Codex scheduled task. The current Codex model performs the vacancy analysis; this project only provides configuration, candidate references, browser login state, and Telegram delivery.

Replace placeholders before creating the automation:

- `{{PROJECT_DIR}}`
- `{{CANDIDATE_NAME}}`
- `{{SEARCH_DESCRIPTION}}`
- `{{SKILL_PATH}}`
- `{{STATE_PATH}}`

```text
Every scheduled run, check recent {{SEARCH_DESCRIPTION}} for {{CANDIDATE_NAME}} and analyze them with the current Codex model.

Important constraints:
- Use the current ChatGPT/Codex model for analysis.
- Use the `$job-fit-analyzer` skill at `{{SKILL_PATH}}`.
- Follow the skill's scoring guide and configured analysis format.
- Only include vacancies published in the last 24 hours unless the project config says otherwise.
- Avoid duplicates with two separate state lists in `{{STATE_PATH}}`:
  - `analyzedUrls`: every URL that has already been analyzed, regardless of score.
  - `reportedUrls`: only URLs that were reported in the scheduled task thread and/or sent to Telegram because score >= configured threshold.
- When loading an old state file that only has `reportedUrls`, treat those URLs as both analyzed and reported for backward compatibility.
- Do not re-analyze URLs already present in `analyzedUrls`.
- Keep operational problems in two categories:
  - `recoveredWarnings`: transient failures that were successfully retried.
  - `operationalErrors`: unrecovered failures that affected the run.

Workflow:
1. Read `{{PROJECT_DIR}}/config/job-watch.config.json`.
2. Open the configured Djinni dashboard and inspect the configured recommended jobs section. If Djinni requires login and cannot be accessed after retry/fallback, record an `operationalErrors` item, skip Djinni for this run, and continue with DOU when possible.
3. Collect configured Djinni vacancy links published in the configured lookback window and not already in `analyzedUrls`.
4. Open the configured DOU listing URL, collect vacancy links published in the configured lookback window and not already in `analyzedUrls`. Prefer original company-specific DOU links from the page.
5. For each new vacancy, retrieve the current vacancy text. If a vacancy cannot be opened/read after retry/fallback, add a short `operationalErrors` note and add its URL to `analyzedUrls` so it is not retried endlessly.
6. Analyze each readable vacancy using `$job-fit-analyzer`.
7. After each vacancy is analyzed, always add its URL to `analyzedUrls`, even if the score is below threshold.
8. Report only vacancies with overall compatibility score >= configured threshold. For each reported vacancy, add the URL to `reportedUrls` and include source, title/company, URL, score, concise analysis, and ready-to-paste application text from the skill.
9. If there are no new matching vacancies above threshold, report a one-line summary in this scheduled task thread and do not send a Telegram vacancy-match message.
10. For any run that has at least one matching vacancy above threshold, write the final user-facing report text to `/private/tmp/vacancy-report.txt`, then run `npm run telegram:send -- /private/tmp/vacancy-report.txt` from `{{PROJECT_DIR}}`.
11. Send a separate Telegram error report only when `operationalErrors` is not empty. Do not send Telegram error reports for `recoveredWarnings` when the run continued successfully.
12. At the end of every run, save `{{STATE_PATH}}` with at least `analyzedUrls`, `reportedUrls`, and `updatedAt`.
13. Keep the scheduled task thread concise. Mention recovered warnings only briefly for debugging.
```
