import { withBrowser } from "./services/browser.js";
import { config } from "./config.js";

async function main(): Promise<void> {
  await withBrowser(async (context) => {
    const djinniPage = await context.newPage();
    await djinniPage.goto(config.sources.djinni.dashboardUrl, { waitUntil: "domcontentloaded" });

    const douPage = await context.newPage();
    await douPage.goto(config.sources.dou.listingUrl, { waitUntil: "domcontentloaded" });

    console.log("Log in to Djinni and DOU in the opened browser windows if needed.");
    console.log("Close the browser window when finished.");
    await Promise.race([
      djinniPage.waitForEvent("close", { timeout: 0 }),
      douPage.waitForEvent("close", { timeout: 0 })
    ]);
  }, { headless: false });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
