import http from "node:http";
import { config } from "./config.js";

const maxBodyBytes = 128 * 1024;

type RelayPayload = {
  chatId?: string;
  text?: string;
  parseMode?: string;
  disableWebPagePreview?: boolean;
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

    if (request.method !== "POST" || request.url !== "/telegram") {
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

    const telegramResponse = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: payload.parseMode || "HTML",
        disable_web_page_preview: payload.disableWebPagePreview ?? true
      })
    });

    if (!telegramResponse.ok) {
      writeJson(response, 502, {
        ok: false,
        error: "telegram_send_failed",
        status: telegramResponse.status,
        body: await telegramResponse.text()
      });
      return;
    }

    writeJson(response, 200, { ok: true });
  } catch (error) {
    writeJson(response, 500, { ok: false, error: error instanceof Error ? error.message : "unknown_error" });
  }
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

function writeJson(response: http.ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(`${JSON.stringify(body)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
