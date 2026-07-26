import { collectDjinni, fetchDjinniDetails } from "./collectors/djinni.js";
import { collectDou, fetchDouDetails } from "./collectors/dou.js";
import { config } from "./config.js";
import { sha256 } from "./lib/hash.js";
import { nowIso } from "./lib/time.js";
import { Analyzer } from "./services/analyzer.js";
import { withBrowser } from "./services/browser.js";
import { Store } from "./services/store.js";
import { Telegram } from "./services/telegram.js";
import type { VacancyDetails, VacancySummary } from "./types.js";
import type { BrowserContext } from "playwright";

async function main(): Promise<void> {
  const store = new Store();
  let analyzer: Analyzer | undefined;
  const sent: string[] = [];

  try {
    await withBrowser(async (context) => {
      const summaries = await collectAll(context);
      console.log(`Collected ${summaries.length} candidate vacancies`);

      let analysesThisRun = 0;
      for (const summary of summaries) {
        if (analysesThisRun >= config.maxAnalysesPerRun) {
          console.log(`Reached MAX_ANALYSES_PER_RUN=${config.maxAnalysesPerRun}; remaining vacancies will be retried later`);
          break;
        }

        const details = await fetchDetails(context, summary);
        const contentHash = sha256(`${details.title}\n${details.company || ""}\n${details.description}`);
        const existing = store.get(details.source, details.url);

        store.upsertDiscovered({
          source: details.source,
          url: details.url,
          title: details.title,
          company: details.company,
          contentHash,
          discoveredAt: details.discoveredAt,
          publishedAt: details.publishedAt
        });

        if (existing?.analyzedAt && existing.contentHash === contentHash) {
          console.log(`Skip already analyzed: ${details.url}`);
          continue;
        }

        let result;
        try {
          analyzer ??= new Analyzer();
          result = await analyzer.analyze(details);
        } catch (error) {
          if (isQuotaOrRateLimitError(error)) {
            console.error(
              "OpenAI API quota/rate limit reached. Add billing/credits or lower MAX_ANALYSES_PER_RUN; this vacancy was not marked analyzed."
            );
            break;
          }
          throw error;
        }

        analysesThisRun += 1;
        store.markAnalyzed({
          source: details.source,
          url: details.url,
          analyzedAt: nowIso(),
          score: result.score,
          analysisText: result.analysisText
        });

        console.log(`Analyzed ${result.score}/10: ${details.url}`);
        if (result.score >= config.minScore) {
          sent.push(formatTelegramMessage(details, result.analysisText));
        }
      }
    });

    if (sent.length > 0) {
      const report = sent.join("\n\n---\n\n");
      if (config.telegram.enabled) {
        const telegram = new Telegram();
        await telegram.send(report);
        console.log(`Sent ${sent.length} Telegram message(s)`);
      } else {
        console.log("Telegram is disabled; matching vacancy report follows:");
        console.log(report);
      }
    } else {
      console.log("No new matching vacancies above threshold");
    }
  } finally {
    store.close();
  }
}

async function collectAll(context: BrowserContext): Promise<VacancySummary[]> {
  const [djinniResult, douResult] = await Promise.allSettled([collectDjinni(context), collectDou(context)]);
  const summaries: VacancySummary[] = [];

  if (djinniResult.status === "fulfilled") {
    summaries.push(...djinniResult.value);
  } else {
    console.error(`Djinni collection failed: ${djinniResult.reason}`);
  }

  if (douResult.status === "fulfilled") {
    summaries.push(...douResult.value);
  } else {
    console.error(`DOU collection failed: ${douResult.reason}`);
  }

  return summaries;
}

async function fetchDetails(
  context: BrowserContext,
  summary: VacancySummary
): Promise<VacancyDetails> {
  if (summary.source === "djinni") return fetchDjinniDetails(context, summary);
  return fetchDouDetails(context, summary);
}

function formatTelegramMessage(vacancy: VacancyDetails, analysisText: string): string {
  return [`${vacancy.source.toUpperCase()}: ${vacancy.title}`, vacancy.company ? `Компания: ${vacancy.company}` : "", vacancy.url, "", analysisText]
    .filter(Boolean)
    .join("\n");
}

function isQuotaOrRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { status?: number; code?: string; type?: string };
  return maybeError.status === 429 || maybeError.code === "insufficient_quota" || maybeError.type === "insufficient_quota";
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
