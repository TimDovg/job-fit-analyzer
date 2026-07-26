import type { BrowserContext } from "playwright";
import { config } from "../config.js";
import { isWithinLookback, nowIso, parseRelativePublishedAt } from "../lib/time.js";
import { newPage } from "../services/browser.js";
import type { VacancyDetails, VacancySummary } from "../types.js";

export async function collectDou(context: BrowserContext): Promise<VacancySummary[]> {
  if (!config.sources.dou.enabled) return [];

  const page = await newPage(context);
  await page.goto(config.sources.dou.listingUrl, { waitUntil: "domcontentloaded" });

  const items = await page.$$eval(".l-vacancy, li, article", (nodes) => {
    const result: Array<{ url: string; title: string; company?: string; around: string }> = [];
    for (const node of nodes) {
      const anchor = node.querySelector<HTMLAnchorElement>("a[href*='/vacancies/']");
      if (!anchor) continue;
      const href = anchor.href;
      const title = (anchor.textContent || "").replace(/\s+/g, " ").trim();
      const company = (node.querySelector(".company, .company-name")?.textContent || "").replace(/\s+/g, " ").trim() || undefined;
      const around = (node.textContent || "").replace(/\s+/g, " ").trim();
      result.push({ url: href, title, company, around });
    }
    return result;
  });

  const unique = new Map<string, VacancySummary>();
  for (const item of items) {
    const normalized = normalizeDouUrl(item.url);
    if (!normalized || unique.has(normalized)) continue;

    const publishedAt = parseRelativePublishedAt(item.around);
    if (!isWithinLookback(publishedAt, config.lookbackHours)) continue;

    unique.set(normalized, {
      source: "dou",
      url: normalized,
      title: item.title || "DOU vacancy",
      company: item.company,
      publishedAt,
      discoveredAt: nowIso()
    });
  }

  await page.close();
  return [...unique.values()].slice(0, config.maxVacanciesPerSource);
}

export async function fetchDouDetails(context: BrowserContext, vacancy: VacancySummary): Promise<VacancyDetails> {
  const page = await newPage(context);
  await page.goto(vacancy.url, { waitUntil: "domcontentloaded" });

  const detail = await page.evaluate(() => {
    const root = document.querySelector(".b-vacancy, main, article") || document.body;
    const text = (root.textContent || "")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
    const title = document.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim();
    const company = document.querySelector(".company, .company-name")?.textContent?.replace(/\s+/g, " ").trim();
    return { text, title, company };
  });

  await page.close();
  return {
    ...vacancy,
    title: detail.title || vacancy.title,
    company: detail.company || vacancy.company,
    description: detail.text
  };
}

function normalizeDouUrl(url: string): string | undefined {
  const parsed = new URL(url);
  if (!parsed.hostname.endsWith("dou.ua")) return undefined;
  const match = parsed.pathname.match(/(?:\/companies\/[^/]+)?\/vacancies\/\d+\/?/);
  if (!match) return undefined;
  return `https://jobs.dou.ua${match[0].endsWith("/") ? match[0] : `${match[0]}/`}`;
}
