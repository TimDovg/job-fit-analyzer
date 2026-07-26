import fs from "node:fs";
import { Telegram } from "./services/telegram.js";

async function main(): Promise<void> {
  const filePath = process.argv[2];
  if (!filePath) {
    throw new Error("Usage: npm run telegram:send -- /path/to/message.txt");
  }

  const text = fs.readFileSync(filePath, "utf8").trim();
  if (!text) {
    console.log("Telegram message file is empty; nothing to send.");
    return;
  }

  const telegram = new Telegram();
  await telegram.send(text);
  console.log("Telegram message sent.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
