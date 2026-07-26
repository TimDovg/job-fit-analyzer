import fs from "node:fs";
import { chromium, type BrowserContext, type Page } from "playwright";
import { config } from "../config.js";

export async function withBrowser<T>(
  callback: (context: BrowserContext) => Promise<T>,
  options: { headless?: boolean } = {}
): Promise<T> {
  fs.mkdirSync(config.browserProfileDir, { recursive: true });
  const context = await chromium.launchPersistentContext(config.browserProfileDir, {
    headless: options.headless ?? config.headless,
    viewport: { width: 1440, height: 1000 }
  });

  try {
    return await callback(context);
  } finally {
    await context.close();
  }
}

export async function newPage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  return page;
}
