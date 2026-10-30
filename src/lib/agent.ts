import type { RequestStatus } from "@prisma/client";
import { officePlace } from "./office-plan";
import { bearerMatches } from "./api-key";
import { isPastGrace, workDayDate } from "./attendance/time";
import { db } from "./db";
import { livePeople } from "./positions";
import { buildReportRows } from "./reports/attendance";
import { statusAfterAssign } from "./requests";
import { formatOfficeTime, todayInOffice } from "./time";

// API для ИИ-агента (/api/agent/*). Ключ — AGENT_API_KEY из .env.
// Агент не получает координаты, пароли и email учётных записей (CLAUDE.md, «Доступ»):
// «где» описывается словами — место, зона на плане, причина выхода и заявка.

export function isAgent(req: Request) {
  return bearerMatches(req.headers.get("authorization"), process.env.AGENT_API_KEY);
}

// Ошибка с кодом — MCP-сервер превращает код в понятное сообщение.
export class AgentError extends Error {
  constructor(
    public code: string,
    public details: Record<string, unknown> = {},
    public status = 400,
  ) {
    super(code);
  }
}

export { zoneAt } from "./office-plan";

const time = (d: Date) => formatOfficeTime(d, "ru");

// Где сейчас все сотрудники и в каком статусе.
export async function whereNow() {
  const now = new Date();
  const [people, live, zones, endedToday] = await Promise.all([
    db.employee.findMany({ where: { isActive: true }, include: { desk: true, user: true }, orderBy: [{ lastName: "asc" }] }),
    livePeople(now),
    db.zone.findMany(),
    db.workDay.findMany({ where: { date: workDayDate(now), endedAt: { not: null } } }),
  ]);
  const liveById = new Map(live.map((p) => [p.employeeId, p]));
  const endedById = new Map(endedToday.map((d) => [d.employeeId, d]));

  return people.map((e) => {
    const l = liveById.get(e.id);
    let place: Record<string, unknown>;
    if (e.status === "IN_OFFICE") {
      const pos = l?.last?.kind === "OFFICE" && l.last.x !== null && l.last.y !== null ? { x: l.last.x, y: l.last.y } : null;
      place = { ...officePlace(pos, e.desk, zones) };
      if (l?.last?.kind === "OFFICE") place.updatedAt = time(l.last.at);
    } else if (e.status === "OUT_OF_OFFICE") {
      place = {
        kind: "out",
        reason: l?.outReason ?? null,
        since: l?.outSince ? time(l.outSince) : null,
        request: l?.request ? { number: l.request.number, client: l.request.client } : null,
        updatedAt: l?.last?.kind === "CITY" ? time(l.last.at) : null,
      };
    } else {
      const ended = endedById.get(e.id);
      place = ended?.endedAt ? { kind: "left", at: time(ended.endedAt) } : { kind: "notCheckedIn" };
    }
    return { name: `${e.firstName} ${e.lastName}`, position: e.position, role: e.user?.role ?? null, status: e.status, place };
  });
}

// Найти сотрудника по имени или фамилии (без учёта регистра, можно часть).
export async function findEmployee(query: string) {
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (!words.length || query.trim().length < 2) throw new AgentError("queryTooShort");
  const found = await db.employee.findMany({
    where: {
      isActive: true,
      AND: words.map((w) => ({
        OR: [{ firstName: { contains: w, mode: "insensitive" as const } }, { lastName: { contains: w, mode: "insensitive" as const } }],
      })),
    },
    include: { desk: true, user: true, requests: { where: { status: { in: ["ASSIGNED", "IN_PROGRESS"] } }, select: { number: true, status: true } } },
    orderBy: [{ lastName: "asc" }],
    take: 20,
  });
  return found.map((e) => ({
    name: `${e.firstName} ${e.lastName}`,
    position: e.position,
    role: e.user?.role ?? null,
    status: e.status,
    desk: e.desk ? { code: e.desk.code, pc: e.desk.pcNumber } : null,
    phone: e.phone,
    activeRequests: e.requests,
  }));
}

// Кто опоздал за день и на сколько минут; после 09:05 — ещё и кто не отметился.
export async function lateOn(date: string | null) {
  const today = todayInOffice();
  const day = date ?? today;
  if (day > today) throw new AgentError("futureDate", { date: day });
  const [late, staff] = await Promise.all([
    db.workDay.findMany({
      where: { date: new Date(`${day}T00:00:00Z`), isLate: true },
      include: { employee: true },
      orderBy: { lateMinutes: "desc" },
    }),
    day === today
      ? db.employee.findMany({
          where: { isActive: true, user: { is: { role: { in: ["EMPLOYEE", "MANAGER"] } } }, workDays: { none: { date: new Date(`${day}T00:00:00Z`) } } },
          orderBy: [{ lastName: "asc" }],
        })
      : Promise.resolve([]),
  ]);
  const pastGrace = day < today || isPastGrace(new Date());
  return {
    date: day,
    late: late.map((d) => ({ name: `${d.employee.firstName} ${d.employee.lastName}`, arrivedAt: time(d.firstInAt), lateMinutes: d.lateMinutes })),
    notCheckedIn: day === today && pastGrace ? staff.map((e) => `${e.firstName} ${e.lastName}`) : [],
    graceNotPassed: day === today && !pastGrace,
  };
}

const MAX_SUMMARY_DAYS = 62;

// Сводка прихода и ухода за период — те же цифры, что в Excel-отчёте.
export async function attendanceSummary(from: string, to: string) {
  if (from > to) throw new AgentError("badPeriod", { from, to });
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1;
  if (days > MAX_SUMMARY_DAYS) throw new AgentError("periodTooLong", { max: MAX_SUMMARY_DAYS });
  const [workDays, employees] = await Promise.all([
    db.workDay.findMany({
      where: { date: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) } },
      include: { employee: true, events: true },
    }),
    db.employee.findMany({ where: { OR: [{ isActive: true }, { workDays: { some: {} } }] } }),
  ]);
  const rows = buildReportRows(workDays, employees);
  return {
    from,
    to,
    summary: rows.summary,
    daily: rows.daily.map((r) => ({
      date: r.date,
      employee: r.employee,
      arrivedAt: time(r.firstIn),
      leftAt: r.end ? time(r.end) : null,
      lateMinutes: r.lateMinutes,
      officeMinutes: r.officeMinutes,
      outMinutes: r.outMinutes,
    })),
  };
}

const ACTIVE: RequestStatus[] = ["ASSIGNED", "IN_PROGRESS"];

// Назначить заявку свободному сотруднику в офисе.
// Свободный — роль «сотрудник», статус «в офисе» и нет заявок «в работе»;
// из таких выбираем того, у кого меньше всего назначенных заявок.
export async function assignToFree(input: { requestNumber: number; employee?: string; reassign?: boolean }) {
  const request = await db.request.findUnique({ where: { number: input.requestNumber }, include: { assignee: true, client: true } });
  if (!request) throw new AgentError("requestNotFound", { number: input.requestNumber }, 404);
  if (request.status === "DONE") throw new AgentError("requestDone", { number: request.number });
  if (request.assignee && !input.reassign) {
    throw new AgentError("alreadyAssigned", { number: request.number, assignee: `${request.assignee.firstName} ${request.assignee.lastName}` });
  }

  const inOffice = await db.employee.findMany({
    where: { isActive: true, status: "IN_OFFICE", user: { is: { role: "EMPLOYEE" } } },
    include: { requests: { where: { status: { in: ACTIVE } }, select: { status: true } } },
    orderBy: [{ lastName: "asc" }],
  });
  const free = inOffice
    .filter((e) => !e.requests.some((r) => r.status === "IN_PROGRESS") && e.id !== request.assigneeId)
    .sort((a, b) => a.requests.length - b.requests.length);

  let chosen = free[0];
  if (input.employee) {
    const matches = await findEmployee(input.employee);
    if (matches.length === 0) throw new AgentError("employeeNotFound", { query: input.employee }, 404);
    if (matches.length > 1) throw new AgentError("employeeAmbiguous", { query: input.employee, names: matches.map((m) => m.name) });
    const wanted = free.find((e) => `${e.firstName} ${e.lastName}` === matches[0].name);
    if (!wanted) throw new AgentError("employeeNotFree", { name: matches[0].name, status: matches[0].status, activeRequests: matches[0].activeRequests.length });
    chosen = wanted;
  }
  if (!chosen) {
    throw new AgentError("noFreeEmployee", { inOffice: inOffice.map((e) => `${e.firstName} ${e.lastName}`) }, 409);
  }

  const status = statusAfterAssign(request.status, true);
  await db.$transaction(async (tx) => {
    await tx.request.update({ where: { id: request.id }, data: { assigneeId: chosen.id, status } });
    await tx.auditLog.create({
      data: {
        actorLabel: "ai-agent",
        entity: "Request",
        entityId: request.id,
        action: "UPDATE",
        before: { assigneeId: request.assigneeId, status: request.status },
        after: { assigneeId: chosen.id, status },
      },
    });
  });

  return {
    number: request.number,
    client: request.client.name,
    description: request.description,
    assignee: `${chosen.firstName} ${chosen.lastName}`,
    previousAssignee: request.assignee ? `${request.assignee.firstName} ${request.assignee.lastName}` : null,
    status,
    assigneeOtherRequests: chosen.requests.length,
  };
}
