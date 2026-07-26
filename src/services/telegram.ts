import { config } from "../config.js";

const telegramLimit = 3900;

export class Telegram {
  constructor() {
    if (!config.telegram.enabled) {
      throw new Error("Telegram is disabled in config.");
    }
    if (!config.notificationWebhookUrl && !config.telegramBotToken) {
      throw new Error("NOTIFICATION_WEBHOOK_URL is required. TELEGRAM_BOT_TOKEN is only for private relay/local fallback.");
    }
    if (!config.telegramChatId) {
      throw new Error("TELEGRAM_CHAT_ID is required. Send /start to your bot, then run npm run doctor.");
    }
  }

  async send(text: string): Promise<void> {
    for (const chunk of splitMessage(formatTelegramHtml(text))) {
      await sendChunk(chunk);
    }
  }
}

async function sendChunk(text: string): Promise<void> {
  if (config.notificationWebhookUrl) {
    const response = await fetch(config.notificationWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.notificationWebhookSecret ? { Authorization: `Bearer ${config.notificationWebhookSecret}` } : {})
      },
      body: JSON.stringify({
        chatId: config.telegramChatId,
        text,
        parseMode: "HTML",
        disableWebPagePreview: true
      })
    });

    if (!response.ok) {
      throw new Error(`Notification webhook failed: ${response.status} ${await response.text()}`);
    }
    return;
  }

  const response = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: config.telegramChatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true
    })
  });

  if (!response.ok) {
    throw new Error(`Telegram send failed: ${response.status} ${await response.text()}`);
  }
}

function formatTelegramHtml(markdown: string): string {
  const codeBlocks: string[] = [];
  const withPlaceholders = markdown.replace(/```(?:\w+)?\n([\s\S]*?)```/g, (_match, code: string) => {
    const index = codeBlocks.push(`<pre><code>${escapeHtml(code.trim())}</code></pre>`) - 1;
    return `\u0000CODE_BLOCK_${index}\u0000`;
  });

  const escaped = escapeHtml(withPlaceholders);
  const withLinks = escaped.replace(/\[([^\]]+)]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
  const withBold = withLinks.replace(/\*\*([^*\n][\s\S]*?[^*\n])\*\*/g, '<b>$1</b>');
  const withReportHighlights = highlightReportLabels(withBold);

  return withReportHighlights.replace(/\u0000CODE_BLOCK_(\d+)\u0000/g, (_match, rawIndex: string) => codeBlocks[Number(rawIndex)] || "");
}

function highlightReportLabels(html: string): string {
  return html
    .replace(/^Найдено (\d+)(?= свежие)/m, "Найдено <b>$1</b>")
    .replace(/^(Источник):/gm, "<b>$1</b>:")
    .replace(/^(Совместимость: [^\n]+)/gm, "<b>$1</b>")
    .replace(/^(Совпадает):/gm, "<b>$1</b>:")
    .replace(/^(НЕ совпадает):/gm, "<b>$1</b>:")
    .replace(/^(Вывод):/gm, "<b>$1</b>:");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function splitMessage(text: string): string[] {
  if (text.length <= telegramLimit) return [text];

  const chunks: string[] = [];
  let rest = text;
  while (rest.length > telegramLimit) {
    const cut = rest.lastIndexOf("\n\n", telegramLimit);
    const end = cut > 500 ? cut : telegramLimit;
    chunks.push(rest.slice(0, end));
    rest = rest.slice(end).trimStart();
  }
  if (rest) chunks.push(rest);
  return chunks;
}
