// MCP-сервер Офис-CRM.
//   cd mcp-server && npm start      — запустить (по умолчанию http://localhost:3100/mcp)
// Вход только с секретным ключом: заголовок «Authorization: Bearer <MCP_SECRET_KEY>».
// Без ключа или с неверным ключом — 401, инструменты не вызываются.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { APP_URL } from "./app-client.js";
import { registerTools } from "./tools.js";

const SECRET = process.env.MCP_SECRET_KEY ?? "";
const PORT = Number(process.env.PORT ?? 3100);
const HOST = process.env.HOST ?? "127.0.0.1";
const MAX_BODY = 1024 * 1024;

if (SECRET.length < 24) {
  console.error(
    "MCP-сервер не запущен: задайте MCP_SECRET_KEY в mcp-server/.env (не короче 24 символов).\n" +
      "Сгенерировать: node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\"",
  );
  process.exit(1);
}

function hasKey(req: IncomingMessage): boolean {
  const given = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(SECRET);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

function sendJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...headers }).end(JSON.stringify(body));
}

// JSON-RPC ошибка — так её поймёт любой MCP-клиент.
const rpcError = (message: string, code = -32001) => ({ jsonrpc: "2.0", error: { code, message }, id: null });

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new Error("tooLarge");
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "null");
}

const http = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (url.pathname === "/health") return sendJson(res, 200, { ok: true });
  if (url.pathname !== "/mcp") return sendJson(res, 404, rpcError("Нет такого адреса. MCP-сервер работает по адресу /mcp.", -32601));

  if (!hasKey(req)) {
    return sendJson(res, 401, rpcError("Доступ запрещён: нужен секретный ключ в заголовке «Authorization: Bearer <ключ>»."), {
      "www-authenticate": 'Bearer realm="office-crm-mcp"',
    });
  }
  // Сервер без сессий: каждый запрос — отдельный POST.
  if (req.method !== "POST") return sendJson(res, 405, rpcError("Этот MCP-сервер принимает только POST-запросы.", -32000), { allow: "POST" });

  let body: unknown;
  try {
    body = await readBody(req);
  } catch (e) {
    const tooLarge = (e as Error).message === "tooLarge";
    return sendJson(res, tooLarge ? 413 : 400, rpcError(tooLarge ? "Слишком большой запрос." : "Запрос не похож на JSON.", -32700));
  }

  const server = new McpServer({ name: "office-crm", version: "0.1.0" });
  registerTools(server);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  } catch (e) {
    console.error("Ошибка MCP:", e);
    if (!res.headersSent) sendJson(res, 500, rpcError("Внутренняя ошибка MCP-сервера.", -32603));
  }
});

http.listen(PORT, HOST, () => {
  console.log(`MCP-сервер Офис-CRM: http://${HOST}:${PORT}/mcp (сайт: ${APP_URL}). Остановить: Ctrl+C`);
});
