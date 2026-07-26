import http from "node:http";
import { config } from "./config.js";

const maxBodyBytes = 128 * 1024;

type RelayPayload = {
  chatId?: string;
  text?: string;
  parseMode?: string;
  disableWebPagePreview?: boolean;
};

type TelegramUpdate = {
  message?: {
    text?: string;
    chat?: {
      id?: number | string;
      type?: string;
    };
    from?: {
      first_name?: string;
    };
  };
};

async function main(): Promise<void> {
  if (!config.telegramBotToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is required on the private notification relay.");
  }

  const server = http.createServer((request, response) => {
    void handleRequest(request, response);
  });

  server.listen(config.notificationRelayPort, () => {
    console.log(`Notification relay listening on port ${config.notificationRelayPort}`);
    console.log(`Relay auth: ${config.notificationRelaySecret ? "enabled" : "disabled"}`);
  });
}

async function handleRequest(request: http.IncomingMessage, response: http.ServerResponse): Promise<void> {
  try {
    if (request.method === "GET" && request.url === "/health") {
      writeJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "POST" && getPathname(request) === "/telegram/webhook") {
      await handleTelegramWebhook(request, response);
      return;
    }

    if (request.method !== "POST" || getPathname(request) !== "/telegram") {
      writeJson(response, 404, { ok: false, error: "not_found" });
      return;
    }

    if (config.notificationRelaySecret) {
      const provided = request.headers.authorization?.replace(/^Bearer\s+/i, "");
      if (provided !== config.notificationRelaySecret) {
        writeJson(response, 401, { ok: false, error: "unauthorized" });
        return;
      }
    }

    const payload = await readJsonBody<RelayPayload>(request);
    const chatId = `${payload.chatId ?? ""}`.trim();
    const text = `${payload.text ?? ""}`.trim();

    if (!chatId) {
      writeJson(response, 400, { ok: false, error: "chatId_required" });
      return;
    }
    if (!text) {
      writeJson(response, 400, { ok: false, error: "text_required" });
      return;
    }

    await sendTelegramMessage({
      chatId,
      text,
      parseMode: payload.parseMode || "HTML",
      disableWebPagePreview: payload.disableWebPagePreview ?? true
    });

    writeJson(response, 200, { ok: true });
  } catch (error) {
    writeJson(response, 500, { ok: false, error: error instanceof Error ? error.message : "unknown_error" });
  }
}

async function handleTelegramWebhook(request: http.IncomingMessage, response: http.ServerResponse): Promise<void> {
  if (config.telegramWebhookSecret) {
    const provided = request.headers["x-telegram-bot-api-secret-token"];
    if (provided !== config.telegramWebhookSecret) {
      writeJson(response, 401, { ok: false, error: "unauthorized" });
      return;
    }
  }

  const update = await readJsonBody<TelegramUpdate>(request);
  const chatId = update.message?.chat?.id;
  if (!chatId) {
    writeJson(response, 200, { ok: true, ignored: true });
    return;
  }

  const text = update.message?.text?.trim() ?? "";
  if (text.startsWith("/start")) {
    await sendTelegramMessage({
      chatId: `${chatId}`,
      text: buildStartMessage(`${chatId}`, update.message?.from?.first_name),
      parseMode: "HTML",
      disableWebPagePreview: true
    });
    writeJson(response, 200, { ok: true });
    return;
  }

  await sendTelegramMessage({
    chatId: `${chatId}`,
    text: "Напиши /start, и я покажу твой chatId для настройки Job Fit Analyzer.",
    parseMode: "HTML",
    disableWebPagePreview: true
  });
  writeJson(response, 200, { ok: true });
}

async function sendTelegramMessage(args: {
  chatId: string;
  text: string;
  parseMode: string;
  disableWebPagePreview: boolean;
}): Promise<void> {
  const telegramResponse = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: args.chatId,
      text: args.text,
      parse_mode: args.parseMode,
      disable_web_page_preview: args.disableWebPagePreview
    })
  });

  if (!telegramResponse.ok) {
    throw new Error(`Telegram send failed: ${telegramResponse.status} ${await telegramResponse.text()}`);
  }
}

function buildStartMessage(chatId: string, firstName: string | undefined): string {
  const greeting = firstName ? `Привет, ${escapeHtml(firstName)}!` : "Привет!";
  return [
    `${greeting} Это бот <b>Job Fit Analyzer</b>.`,
    "",
    `Твой chatId: <code>${escapeHtml(chatId)}</code>`,
    "",
    "Как настроить проект:",
    "1. Скопируй этот chatId.",
    "2. Замени <code>example_resume.pdf</code> своим резюме.",
    "3. Запусти <code>npm run setup</code> и вставь chatId, когда попросят.",
    "",
    "После настройки Codex scheduled task будет присылать сюда подходящие вакансии."
  ].join("\n");
}

async function readJsonBody<T>(request: http.IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > maxBodyBytes) {
      throw new Error("Request body is too large");
    }
    chunks.push(buffer);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) {
    throw new Error("JSON body is required");
  }

  return JSON.parse(raw) as T;
}

function getPathname(request: http.IncomingMessage): string {
  return new URL(request.url ?? "/", "http://localhost").pathname;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function writeJson(response: http.ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(`${JSON.stringify(body)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
