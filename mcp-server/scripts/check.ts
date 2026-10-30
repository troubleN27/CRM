// Проверка MCP-сервера (он и сайт должны быть запущены):
//   cd mcp-server && npm test
// Ничего не меняет в данных: назначение проверяется только на ошибках.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const URL_MCP = process.env.MCP_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3100}/mcp`;
const KEY = process.env.MCP_SECRET_KEY ?? "";

let failed = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? "✔" : "✘"} ${msg}`);
  if (!ok) failed++;
};

// 1. Без ключа и с чужим ключом — не пускает.
const initBody = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "check", version: "1" } } });
const headers = { "content-type": "application/json", accept: "application/json, text/event-stream" };
const noKey = await fetch(URL_MCP, { method: "POST", headers, body: initBody });
check(noKey.status === 401, `без ключа — отказ (${noKey.status}): ${(await noKey.json()).error?.message}`);
const wrongKey = await fetch(URL_MCP, { method: "POST", headers: { ...headers, authorization: "Bearer wrong-key-wrong-key-wrong-key" }, body: initBody });
check(wrongKey.status === 401, `с чужим ключом — отказ (${wrongKey.status})`);

// 2. С ключом — подключаемся как настоящий MCP-клиент.
const client = new Client({ name: "office-crm-check", version: "1.0.0" });
await client.connect(new StreamableHTTPClientTransport(new URL(URL_MCP), { requestInit: { headers: { authorization: `Bearer ${KEY}` } } }));
const { tools } = await client.listTools();
check(tools.length === 5, `с ключом — 5 инструментов: ${tools.map((t) => t.name).join(", ")}`);

const call = async (name: string, args: Record<string, unknown> = {}) => {
  const r = await client.callTool({ name, arguments: args });
  const text = (r.content as { type: string; text: string }[]).map((c) => c.text).join("\n");
  return { text, isError: Boolean(r.isError) };
};
const show = (text: string, lines = 4) => text.split("\n").slice(0, lines).map((l) => `    ${l}`).join("\n");

const where = await call("where_is_everyone");
check(!where.isError && where.text.includes("В офисе:"), "where_is_everyone — где все и в каком статусе");
console.log(show(where.text, 6));

const found = await call("find_employee", { name: "алис" });
check(!found.isError && found.text.includes("Алиса Тестова"), "find_employee «алис» → Алиса Тестова");
console.log(show(found.text));
const none = await call("find_employee", { name: "Несуществующий" });
check(!none.isError && none.text.includes("никого не нашлось"), "find_employee — понятный ответ, если никого нет");

const late = await call("late_today");
check(!late.isError && late.text.startsWith("Опоздания за"), "late_today — опоздания за сегодня");
console.log(show(late.text));
const badDate = await call("late_today", { date: "2099-01-01" });
check(badDate.isError && badDate.text.includes("ещё не наступила"), `late_today с будущей датой — ${badDate.text}`);

const summary = await call("attendance_summary", { from: "2026-10-23", to: "2026-10-23" });
check(!summary.isError && summary.text.includes("Тестова Алиса: приход 09:12, уход 18:00, опоздание 12 мин, в офисе 7 ч 48 мин, вне офиса 1 ч 00 мин"), "attendance_summary — пример 09:12 / обед / 18:00");
const longPeriod = await call("attendance_summary", { from: "2026-01-01", to: "2026-10-23" });
check(longPeriod.isError && longPeriod.text.includes("слишком длинный"), `attendance_summary за 10 месяцев — ${longPeriod.text}`);

const missing = await call("assign_request_to_free_employee", { request_number: 9999 });
check(missing.isError && missing.text.includes("#9999 не найдена"), `назначение несуществующей заявки — ${missing.text}`);
const done = await call("assign_request_to_free_employee", { request_number: 9 });
check(done.isError && done.text.includes("уже выполнена"), `назначение выполненной заявки — ${done.text}`);
const taken = await call("assign_request_to_free_employee", { request_number: 3 });
check(taken.isError && taken.text.includes("уже назначена"), `назначение занятой заявки — ${taken.text}`);

await client.close();
console.log(failed ? `\nОшибок: ${failed}` : "\nВсе проверки пройдены");
process.exit(failed ? 1 : 0);
