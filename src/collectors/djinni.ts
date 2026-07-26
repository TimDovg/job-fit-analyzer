import type { BrowserContext } from "playwright";
import { config } from "../config.js";
import { isWithinLookback, nowIso, parseRelativePublishedAt } from "../lib/time.js";
import { newPage } from "../services/browser.js";
import type { VacancyDetails, VacancySummary } from "../types.js";

export async function collectDjinni(context: BrowserContext): Promise<VacancySummary[]> {
  if (!config.sources.djinni.enabled) return [];

  const page = await newPage(context);
  await page.goto(config.sources.djinni.dashboardUrl, { waitUntil: "domcontentloaded" });

  if (/login|signin|auth/i.test(page.url())) {
    throw new Error("Djinni session is not logged in. Run npm run login and sign in to Djinni.");
  }

  const links = await page.$$eval("a[href]", (anchors) => {
    const result: Array<{ url: string; text: string; around: string }> = [];
    for (const anchor of anchors) {
      const href = anchor.getAttribute("href") || "";
      const text = (anchor.textContent || "").replace(/\s+/g, " ").trim();
      const around = (anchor.closest("article, li, .list-jobs__item, .job-list-item, .card, tr, div")?.textContent || "")
        .replace(/\s+/g, " ")
        .trim();
      if (/\/jobs\/\d+/.test(href) || /\/jobs\/\?/.test(href)) {
        result.push({ url: new URL(href, location.origin).toString(), text, around });
      }
    }
    return result;
  });

  const unique = new Map<string, VacancySummary>();
  for (const link of links) {
    const normalized = normalizeDjinniUrl(link.url);
    if (!normalized || unique.has(normalized)) continue;

    const publishedAt = parseRelativePublishedAt(link.around);
    if (!isWithinLookback(publishedAt, config.lookbackHours)) continue;

    unique.set(normalized, {
      source: "djinni",
      url: normalized,
      title: link.text || firstMeaningfulLine(link.around) || "Djinni vacancy",
      company: extractCompany(link.around),
      publishedAt,
      discoveredAt: nowIso()
    });
  }

  await page.close();
  return [...unique.values()].slice(0, config.maxVacanciesPerSource);
}

export async function fetchDjinniDetails(context: BrowserContext, vacancy: VacancySummary): Promise<VacancyDetails> {
  const page = await newPage(context);
  await page.goto(vacancy.url, { waitUntil: "domcontentloaded" });

  const detail = await page.evaluate(() => {
    const text = (document.querySelector("main")?.textContent || document.body.textContent || "")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
    const title = document.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim();
    return { text, title };
  });

  await page.close();
  return {
    ...vacancy,
    title: detail.title || vacancy.title,
    description: detail.text
  };
}

function normalizeDjinniUrl(url: string): string | undefined {
  const parsed = new URL(url);
  if (!parsed.hostname.endsWith("djinni.co")) return undefined;
  const match = parsed.pathname.match(/\/jobs\/\d+[^/]*/);
  if (!match) return undefined;
  return `https://djinni.co${match[0]}/`;
}

function firstMeaningfulLine(text: string): string | undefined {
  return text.split(/[.!?]\s|\n/).map((line) => line.trim()).find((line) => line.length > 8);
}

function extractCompany(text: string): string | undefined {
  const match = text.match(/\bat\s+([^,|]+)|компан(?:ія|ии)\s+([^,|]+)/i);
  return (match?.[1] || match?.[2])?.trim();
}
