---
name: job-fit-analyzer
description: Analyze job vacancies against the configured candidate's resume/profile and produce compatibility scores, matching experience, missing experience, recommendations, and ready-to-paste application answers.
---

# Job Fit Analyzer

Use this skill to evaluate vacancies and draft application responses for the candidate configured in `references/`.

## Candidate Reference

Read `references/resume.md` and `references/candidate-profile.md` before comparing a vacancy to the candidate's experience, drafting a tailored application answer, or answering recruiter/application-form questions.

Treat `references/resume.md` as the full CV source of truth. Treat `references/candidate-profile.md` as the concise positioning guide for preferred roles, scoring priorities, honest limitations, language level, compensation, notice period, and application-message emphasis.

Do not rely on candidate-specific details from this `SKILL.md`. All personal facts, strengths, gaps, compensation expectations, and overclaiming limits must come from the reference files.

## Vacancy Intake

When a vacancy link is provided, retrieve the current vacancy text before analyzing. If the page requires authentication and cannot be read, ask for pasted vacancy text or a fresh login.

When vacancy text is already provided, analyze that text without extra browsing unless current details are needed.

## Default Analysis Format

Write vacancy analysis in Russian unless the user requests another language.

Start with:

`Источник: [<vacancy title/company>](<vacancy URL>), опубликовано <publication date>.`

If the publication date is unavailable, write:

`Источник: [<vacancy title/company>](<vacancy URL>), дата публикации не указана.`

Then add:

`Совместимость: X/10`

Then use:

**Что совпадает**
- List the candidate's relevant matching experience.

**Что слабее / отсутствует**
- List missing, weaker, or risky requirements.

**Вывод**
- Give a short practical recommendation: apply, maybe apply, low priority, or do not apply.
- Mention whether the role is a strong match, stretch, or poor match.
- If useful, mention what to emphasize in an application.

**Текст для отклика**
- Add a ready-to-paste paragraph or short message answering why the candidate is interested and why they fit.
- Write this application text in English by default unless the user or `references/candidate-profile.md` requests another language.
- Put only the application text inside a fenced `text` code block immediately under the heading.
- Keep it concise, honest, tailored, and positive about manageable gaps.

## Scoring Guide

Use this general scoring scale, then adjust according to the role preferences, strengths, weak fits, and constraints in `references/candidate-profile.md`.

- 9-10: Very strong match; core stack, level, format, and domain align.
- 8-8.5: Strong match with minor gaps.
- 7-7.5: Good match with noticeable but manageable gaps.
- 6-6.5: Possible stretch.
- 5-5.5: Weak or risky stretch.
- Below 5: Not recommended.

Raise the score when the vacancy strongly matches the candidate's preferred roles, strongest commercial experience, desired domain direction, seniority, location/remote preference, and compensation expectations.

Lower the score when the vacancy is centered on technologies, domains, seniority expectations, management scope, location requirements, or work format listed as weak fits or honest limitations in `references/candidate-profile.md`.

Do not reward a role only because it contains familiar keywords. Prioritize evidence from actual work experience, depth, recency, and match to mandatory requirements.

## Application Answers

When the user asks for a response to an application prompt, write only a ready-to-paste answer unless they ask for analysis too.

Application messages should:
- Be honest and concise.
- Emphasize the candidate's strongest relevant experience.
- Mention adjacent or learning-oriented experience only when relevant and accurately framed.
- Avoid overclaiming anything listed under honest limitations or weak fits.
- If there is a major gap, phrase it carefully, for example: “my main commercial experience is X, but I’m motivated to grow in Y.”

Use `references/candidate-profile.md` for short factual answers such as language level, notice period, work authorization, relocation preference, expected compensation, and demographic questions when the profile contains a stated preference.
