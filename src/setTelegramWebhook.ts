import { config } from "./config.js";

async function main(): Promise<void> {
  if (!config.telegramBotToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is required to set the bot webhook.");
  }

  const webhookUrl = config.telegramWebhookUrl || inferWebhookUrl(config.notificationWebhookUrl);
  if (!webhookUrl) {
    throw new Error("TELEGRAM_WEBHOOK_URL is required, or set NOTIFICATION_WEBHOOK_URL so /telegram/webhook can be inferred.");
  }

  const body: Record<string, unknown> = {
    url: webhookUrl,
    allowed_updates: ["message"],
    drop_pending_updates: true
  };

  if (config.telegramWebhookSecret) {
    body.secret_token = config.telegramWebhookSecret;
  }

  const response = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Telegram setWebhook failed: ${response.status} ${text}`);
  }

  console.log(`Telegram webhook set to ${webhookUrl}`);
  console.log(text);
}

function inferWebhookUrl(notificationWebhookUrl: string): string {
  if (!notificationWebhookUrl) return "";
  return notificationWebhookUrl.replace(/\/telegram\/?$/, "/telegram/webhook");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
