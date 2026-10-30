import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { callApp, FriendlyError } from "./app-client.js";

// Инструменты для ИИ-агента. Ответ — понятный текст на русском; при ошибке — isError и объяснение.

const STATUS: Record<string, string> = { IN_OFFICE: "в офисе", OUT_OF_OFFICE: "вне офиса", OFF_WORK: "не на работе" };
const REASON: Record<string, string> = { LUNCH: "обед", CLIENT_VISIT: "выезд на заявку", PERSONAL: "личное" };
const REQUEST_STATUS: Record<string, string> = { NEW: "новая", ASSIGNED: "назначена", IN_PROGRESS: "в работе", DONE: "выполнена" };
const ROLE: Record<string, string> = { ADMIN: "админ", MANAGER: "менеджер", EMPLOYEE: "сотрудник" };
const hm = (min: number) => `${Math.floor(min / 60)} ч ${String(min % 60).padStart(2, "0")} мин`;

type Place =
  | { kind: "desk"; desk: string; updatedAt?: string }
  | { kind: "zone"; zone: string; updatedAt?: string }
  | { kind: "office"; updatedAt?: string }
  | { kind: "out"; reason: string | null; since: string | null; request: { number: number; client: string } | null; updatedAt: string | null }
  | { kind: "left"; at: string }
  | { kind: "notCheckedIn" };

function describePlace(p: Place): string {
  switch (p.kind) {
    case "desk":
      return `на своём месте ${p.desk}`;
    case "zone":
      return `в зоне «${p.zone}»`;
    case "office":
      return "в офисе";
    case "out": {
      const parts = [p.reason ? REASON[p.reason] ?? p.reason : "вне офиса"];
      if (p.since) parts.push(`с ${p.since}`);
      if (p.request) parts.push(`заявка #${p.request.number} (${p.request.client})`);
      parts.push(p.updatedAt ? `последняя точка в ${p.updatedAt}` : "местоположение неизвестно");
      return parts.join(", ");
    }
    case "left":
      return `рабочий день закончен в ${p.at}`;
    case "notCheckedIn":
      return "сегодня ещё нет отметки прихода";
  }
}

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

// Любая ошибка превращается в понятное сообщение, а не в стек вызовов.
async function safely(fn: () => Promise<string>) {
  try {
    return text(await fn());
  } catch (e) {
    const message = e instanceof FriendlyError ? e.message : `Не получилось выполнить запрос: ${(e as Error).message}`;
    return { ...text(`Ошибка: ${message}`), isError: true };
  }
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате ГГГГ-ММ-ДД, например 2026-10-23");

export function registerTools(server: McpServer) {
  server.registerTool(
    "where_is_everyone",
    {
      title: "Где сейчас сотрудники",
      description:
        "Показать, где сейчас все сотрудники и в каком статусе: в офисе (на своём месте или в какой зоне — кухня, переговорная), вне офиса (обед, выезд по заявке, личное) или не на работе. Координаты не выдаются.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () =>
      safely(async () => {
        const { people } = await callApp<{ people: { name: string; position: string; status: string; place: Place }[] }>("/api/agent/status");
        const groups = ["IN_OFFICE", "OUT_OF_OFFICE", "OFF_WORK"].map((s) => {
          const list = people.filter((p) => p.status === s);
          const lines = list.map((p) => `• ${p.name} (${p.position}) — ${describePlace(p.place)}`);
          return `${STATUS[s][0].toUpperCase()}${STATUS[s].slice(1)}: ${list.length}\n${lines.join("\n") || "• никого"}`;
        });
        return groups.join("\n\n");
      }),
  );

  server.registerTool(
    "find_employee",
    {
      title: "Найти сотрудника",
      description: "Найти сотрудника по имени или фамилии (можно часть, регистр не важен). Показывает должность, статус, рабочее место, телефон и активные заявки.",
      inputSchema: { name: z.string().min(2, "Напишите хотя бы 2 буквы").describe("Имя, фамилия или их часть, например «Алиса» или «тест»") },
      annotations: { readOnlyHint: true },
    },
    ({ name }) =>
      safely(async () => {
        const { employees } = await callApp<{
          employees: {
            name: string;
            position: string;
            role: string | null;
            status: string;
            desk: { code: string; pc: string | null } | null;
            phone: string | null;
            activeRequests: { number: number; status: string }[];
          }[];
        }>(`/api/agent/search?q=${encodeURIComponent(name)}`);
        if (!employees.length) return `По запросу «${name}» никого не нашлось. Попробуйте другую часть имени или фамилии.`;
        return employees
          .map((e) =>
            [
              `${e.name} — ${e.position}${e.role ? ` (${ROLE[e.role] ?? e.role})` : ""}`,
              `  статус: ${STATUS[e.status] ?? e.status}`,
              `  место: ${e.desk ? `${e.desk.code}${e.desk.pc ? `, компьютер ${e.desk.pc}` : ""}` : "не назначено"}`,
              e.phone ? `  телефон: ${e.phone}` : null,
              `  заявки: ${e.activeRequests.length ? e.activeRequests.map((r) => `#${r.number} (${REQUEST_STATUS[r.status]})`).join(", ") : "нет активных"}`,
            ]
              .filter(Boolean)
              .join("\n"),
          )
          .join("\n\n");
      }),
  );

  server.registerTool(
    "late_today",
    {
      title: "Кто опоздал",
      description: "Показать, кто опоздал и на сколько минут (рабочий день с 09:00, допуск 5 минут). Без даты — сегодня; сегодня после 09:05 ещё и кто не отметился.",
      inputSchema: { date: isoDate.optional().describe("Дата ГГГГ-ММ-ДД; если не указана — сегодня") },
      annotations: { readOnlyHint: true },
    },
    ({ date }) =>
      safely(async () => {
        const r = await callApp<{ date: string; late: { name: string; arrivedAt: string; lateMinutes: number }[]; notCheckedIn: string[]; graceNotPassed: boolean }>(
          `/api/agent/late${date ? `?date=${date}` : ""}`,
        );
        const lines = [`Опоздания за ${r.date}:`];
        lines.push(...(r.late.length ? r.late.map((l) => `• ${l.name} — приход в ${l.arrivedAt}, опоздание ${l.lateMinutes} мин`) : ["• никто не опоздал"]));
        if (r.graceNotPassed) lines.push("", "Ещё нет 09:05 по времени офиса — кто не отметился, станет видно позже.");
        else if (r.notCheckedIn.length) lines.push("", `Не отметились после 09:05: ${r.notCheckedIn.join(", ")}`);
        return lines.join("\n");
      }),
  );

  server.registerTool(
    "attendance_summary",
    {
      title: "Сводка прихода и ухода",
      description:
        "Сводка прихода и ухода за период (до 62 дней): по каждому сотруднику — дни на работе, опоздания, часы в офисе и вне офиса; и по дням — приход, уход, опоздание. Те же цифры, что в Excel-отчёте.",
      inputSchema: {
        from: isoDate.describe("Начало периода ГГГГ-ММ-ДД"),
        to: isoDate.describe("Конец периода ГГГГ-ММ-ДД"),
      },
      annotations: { readOnlyHint: true },
    },
    ({ from, to }) =>
      safely(async () => {
        const r = await callApp<{
          summary: { employee: string; days: number; lateCount: number; officeMinutes: number; outMinutes: number }[];
          daily: { date: string; employee: string; arrivedAt: string; leftAt: string | null; lateMinutes: number; officeMinutes: number; outMinutes: number }[];
        }>(`/api/agent/attendance?from=${from}&to=${to}`);
        const worked = r.summary.filter((s) => s.days > 0);
        if (!worked.length) return `За ${from} — ${to} отметок прихода нет.`;
        const summary = worked.map(
          (s) => `• ${s.employee}: дней ${s.days}, опозданий ${s.lateCount}, в офисе ${hm(s.officeMinutes)}, вне офиса ${hm(s.outMinutes)}`,
        );
        const daily = r.daily.map(
          (d) =>
            `• ${d.date} ${d.employee}: приход ${d.arrivedAt}, уход ${d.leftAt ?? "день не закрыт"}${d.lateMinutes ? `, опоздание ${d.lateMinutes} мин` : ""}, в офисе ${hm(d.officeMinutes)}, вне офиса ${hm(d.outMinutes)}`,
        );
        return [`Сводка за ${from} — ${to}`, "", "По сотрудникам:", ...summary, "", "По дням:", ...daily].join("\n");
      }),
  );

  server.registerTool(
    "assign_request_to_free_employee",
    {
      title: "Назначить заявку свободному сотруднику",
      description:
        "Назначить заявку свободному сотруднику, который сейчас в офисе (роль «сотрудник», нет заявок «в работе»; из таких — у кого меньше назначенных). Можно указать конкретного сотрудника — он тоже должен быть свободен и в офисе. Уже назначенную заявку передаёт другому только с reassign: true.",
      inputSchema: {
        request_number: z.number().int().positive().describe("Номер заявки, например 2 для #2"),
        employee_name: z.string().min(2).optional().describe("Кому назначить (необязательно): имя или фамилия"),
        reassign: z.boolean().optional().describe("true — передать уже назначенную заявку другому"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    ({ request_number, employee_name, reassign }) =>
      safely(async () => {
        const r = await callApp<{
          number: number;
          client: string;
          description: string;
          assignee: string;
          previousAssignee: string | null;
          status: string;
          assigneeOtherRequests: number;
        }>("/api/agent/assign", { method: "POST", body: { requestNumber: request_number, employee: employee_name, reassign } });
        return [
          `Готово: заявка #${r.number} (${r.client} — «${r.description}») назначена на ${r.assignee}.`,
          r.previousAssignee ? `Раньше была у: ${r.previousAssignee}.` : null,
          `Статус заявки: ${REQUEST_STATUS[r.status] ?? r.status}. Других назначенных заявок у ${r.assignee}: ${r.assigneeOtherRequests}.`,
        ]
          .filter(Boolean)
          .join("\n");
      }),
  );
}
