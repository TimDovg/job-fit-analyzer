import { config } from "./config.js";
import fs from "node:fs";
import path from "node:path";

async function main(): Promise<void> {
  console.log("Config:");
  console.log(`- config file: ${config.configPath}`);
  console.log(`- candidate: ${config.candidate.displayName}`);
  console.log(`- search: ${config.candidate.searchDescription}`);
  console.log(`- model: ${config.openaiModel}`);
  console.log(`- min score: ${config.minScore}`);
  console.log(`- lookback hours: ${config.lookbackHours}`);
  console.log(`- skill dir: ${config.skill.dir}`);
  console.log(`- skill file: ${config.skill.skillFile}`);
  console.log(`- resume file: ${config.skill.resumeFile}`);
  console.log(`- profile file: ${config.skill.profileFile}`);
  console.log(`- data dir: ${config.dataDir}`);
  console.log(`- browser profile: ${config.browserProfileDir}`);
  console.log(`- Djinni: ${config.sources.djinni.enabled ? config.sources.djinni.dashboardUrl : "disabled"}`);
  console.log(`- DOU: ${config.sources.dou.enabled ? config.sources.dou.listingUrl : "disabled"}`);
  console.log(`- OpenAI key: ${config.openaiApiKey ? "present" : "missing"}`);
  console.log(`- Telegram token: ${config.telegramBotToken ? "present" : "missing"}`);
  console.log(`- Telegram chat id: ${mask(config.telegramChatId)}`);
  console.log(`- skill files exist: ${skillFilesExist() ? "yes" : "no"}`);

  if (config.telegramBotToken) {
    const response = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/getUpdates`);
    console.log(`Telegram getUpdates: ${response.status}`);
    const body = await response.json().catch(() => undefined) as { ok?: boolean; result?: unknown[] } | undefined;
    if (body) {
      console.log(`Telegram getUpdates ok: ${body.ok === true ? "yes" : "no"}`);
      console.log(`Telegram updates visible: ${Array.isArray(body.result) ? body.result.length : "unknown"}`);
    }
  }
}

function skillFilesExist(): boolean {
  return [config.skill.skillFile, config.skill.resumeFile, config.skill.profileFile]
    .map((relativePath) => path.resolve(config.skill.dir, relativePath))
    .every((filePath) => fs.existsSync(filePath));
}

function mask(value: string): string {
  if (!value) return "missing";
  if (value.length <= 4) return "present";
  return `${value.slice(0, 2)}...${value.slice(-2)}`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
