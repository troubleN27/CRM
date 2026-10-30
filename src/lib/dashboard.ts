import { officeClock, workDayDate } from "./attendance/time";
import { db } from "./db";
import { officePlace, type OfficePlace } from "./office-plan";
import { employeeTodayRoute, livePeople } from "./positions";
import { formatOfficeTime } from "./time";

// Данные для главной админа и страницы «На карте города». Обновляются в браузере каждые 3 секунды.

// У каждого человека свой постоянный цвет точки.
const PALETTE = ["#4f6f99", "#8a5a78", "#5a8a68", "#9a7442", "#6f5f9a", "#4f8790", "#8e7f45", "#9a5656", "#5d679c", "#4f8a78"];
export function personColor(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export type DashboardPerson = {
  employeeId: string;
  name: string;
  initials: string;
  color: string;
  x: number;
  y: number;
  place: OfficePlace;
  lastMark: { kind: "checkIn" | "back"; time: string } | null;
};

export type FeedItem = {
  id: string;
  kind: "checkIn" | "out" | "back" | "endOfDay" | "assigned";
  time: string;
  date: string;
  isToday: boolean;
  name: string;
  reason?: string | null;
  request?: { number: number; client: string } | null;
  assignee?: string;
  byAgent?: boolean;
};

const FEED_SIZE = 12;

export async function adminDashboard(locale: string) {
  const now = new Date();
  const today = workDayDate(now);
  const todayStr = officeClock(now).date;
  const time = (d: Date) => formatOfficeTime(d, locale);

  const [employees, todayDays, inProgress, live, zones, events, audits] = await Promise.all([
    db.employee.findMany({ where: { isActive: true }, select: { id: true, status: true, firstName: true, lastName: true, user: { select: { role: true } } } }),
    db.workDay.findMany({ where: { date: today }, select: { employeeId: true, isLate: true } }),
    db.request.count({ where: { status: "IN_PROGRESS" } }),
    livePeople(now),
    db.zone.findMany(),
    db.attendanceEvent.findMany({
      orderBy: { at: "desc" },
      take: FEED_SIZE,
      include: { workDay: { include: { employee: true } }, request: { include: { client: true } } },
    }),
    db.auditLog.findMany({ where: { entity: "Request" }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);

  const checkedIn = new Set(todayDays.map((d) => d.employeeId));
  const staff = employees.filter((e) => e.user?.role !== "ADMIN");
  const stats = {
    inOffice: employees.filter((e) => e.status === "IN_OFFICE").length,
    outOfOffice: employees.filter((e) => e.status === "OUT_OF_OFFICE").length,
    notArrived: staff.filter((e) => !checkedIn.has(e.id)).length,
    late: todayDays.filter((d) => d.isLate).length,
    inProgress,
  };

  // Мини-карта: только те, кто сейчас в офисе.
  const people: DashboardPerson[] = live
    .filter((p) => p.status === "IN_OFFICE")
    .flatMap((p) => {
      const sensor = p.last?.kind === "OFFICE" && p.last.x !== null && p.last.y !== null ? { x: p.last.x, y: p.last.y } : null;
      const pos = sensor ?? p.desk;
      if (!pos) return [];
      return [
        {
          employeeId: p.employeeId,
          name: p.name,
          initials: p.initials,
          color: personColor(p.employeeId),
          x: pos.x,
          y: pos.y,
          place: officePlace(sensor, p.desk, zones),
          lastMark: p.lastMark && p.lastMark.kind !== "out" ? { kind: p.lastMark.kind, time: time(p.lastMark.at) } : null,
        },
      ];
    });

  // Лента: отметки и назначения заявок, самые свежие сверху.
  const feed: (FeedItem & { sortAt: number })[] = events.map((e) => {
    const emp = e.workDay.employee;
    const kind = e.type === "IN" ? (e.at.getTime() === e.workDay.firstInAt.getTime() ? "checkIn" : "back") : e.reason === "END_OF_DAY" ? "endOfDay" : "out";
    const date = officeClock(e.at).date;
    return {
      id: `e-${e.id}`,
      kind,
      time: time(e.at),
      date,
      isToday: date === todayStr,
      name: `${emp.firstName} ${emp.lastName}`,
      reason: kind === "out" ? e.reason : null,
      request: e.request ? { number: e.request.number, client: e.request.client.name } : null,
      sortAt: e.at.getTime(),
    };
  });

  const assignments = audits.filter((a) => {
    const after = a.after as { assigneeId?: string | null } | null;
    const before = a.before as { assigneeId?: string | null } | null;
    return after?.assigneeId && after.assigneeId !== before?.assigneeId;
  });
  if (assignments.length) {
    const ids = new Set<string>();
    for (const a of assignments) ids.add((a.after as { assigneeId: string }).assigneeId);
    const [requests, assignees, actors] = await Promise.all([
      db.request.findMany({ where: { id: { in: assignments.map((a) => a.entityId) } }, include: { client: true } }),
      db.employee.findMany({ where: { id: { in: [...ids] } } }),
      db.user.findMany({ where: { id: { in: assignments.flatMap((a) => (a.actorUserId ? [a.actorUserId] : [])) } }, include: { employee: true } }),
    ]);
    for (const a of assignments) {
      const req = requests.find((r) => r.id === a.entityId);
      const who = assignees.find((e) => e.id === (a.after as { assigneeId: string }).assigneeId);
      const actor = actors.find((u) => u.id === a.actorUserId);
      if (!req || !who) continue;
      const date = officeClock(a.createdAt).date;
      feed.push({
        id: `a-${a.id}`,
        kind: "assigned",
        time: time(a.createdAt),
        date,
        isToday: date === todayStr,
        name: actor ? `${actor.employee.firstName} ${actor.employee.lastName}` : "",
        byAgent: a.actorLabel === "ai-agent",
        request: { number: req.number, client: req.client.name },
        assignee: `${who.firstName} ${who.lastName}`,
        sortAt: a.createdAt.getTime(),
      });
    }
  }

  // Графики: посещаемость за последние 7 рабочих дней и заявки по статусам.
  const days: string[] = [];
  for (const d = new Date(`${todayStr}T00:00:00Z`); days.length < 7; d.setUTCDate(d.getUTCDate() - 1)) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) days.unshift(d.toISOString().slice(0, 10));
  }
  const [byDay, byStatus] = await Promise.all([
    db.workDay.groupBy({
      by: ["date", "isLate"],
      where: { date: { gte: new Date(`${days[0]}T00:00:00Z`), lte: today } },
      _count: true,
    }),
    db.request.groupBy({ by: ["status"], _count: true }),
  ]);
  const attendance = days.map((date) => {
    const of = (late: boolean) => byDay.find((g) => g.date.toISOString().slice(0, 10) === date && g.isLate === late)?._count ?? 0;
    return { date, onTime: of(false), late: of(true) };
  });
  const requestsByStatus = (["NEW", "ASSIGNED", "IN_PROGRESS", "DONE"] as const).map((status) => ({
    status,
    count: byStatus.find((g) => g.status === status)?._count ?? 0,
  }));

  return {
    stats,
    attendance,
    requestsByStatus,
    people,
    feed: feed.sort((a, b) => b.sortAt - a.sortAt).slice(0, FEED_SIZE),
    updatedAt: time(now),
  };
}

export type AdminDashboardData = Awaited<ReturnType<typeof adminDashboard>>;

function parseLatLng(value: string | undefined) {
  const [lat, lng] = (value ?? "").split(",").map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

// Карта города: офис, открытые заявки (по клиентам) и сотрудники «вне офиса».
export async function cityMap(locale: string) {
  const now = new Date();
  const time = (d: Date) => formatOfficeTime(d, locale);
  const office = parseLatLng(process.env.OFFICE_LOCATION) ?? parseLatLng(process.env.CITY_CENTER) ?? { lat: 41.3111, lng: 69.2797 };

  const [live, requests] = await Promise.all([
    livePeople(now),
    db.request.findMany({ where: { status: { not: "DONE" } }, include: { client: true, assignee: true }, orderBy: { number: "asc" } }),
  ]);

  const byClient = new Map<string, { id: string; client: string; address: string; lat: number; lng: number; requests: { number: number; description: string; status: string; assignee: string | null }[] }>();
  for (const r of requests) {
    const c = byClient.get(r.clientId) ?? { id: r.clientId, client: r.client.name, address: r.client.address, lat: r.client.lat, lng: r.client.lng, requests: [] };
    c.requests.push({
      number: r.number,
      description: r.description,
      status: r.status,
      assignee: r.assignee ? `${r.assignee.firstName} ${r.assignee.lastName}` : null,
    });
    byClient.set(r.clientId, c);
  }

  const trackedPeople = live.filter(
    (p) => p.status === "OUT_OF_OFFICE" || (p.isGpsTracked && p.last?.kind === "CITY")
  );
  const routes = await Promise.all(
    trackedPeople.map((p) => (p.isGpsTracked ? employeeTodayRoute(p.employeeId, now) : Promise.resolve({ points: [], totalKm: 0 })))
  );

  const out = trackedPeople.map((p, idx) => ({
    employeeId: p.employeeId,
    name: p.name,
    color: personColor(p.employeeId),
    reason: p.outReason,
    since: p.outSince ? time(p.outSince) : null,
    request: p.request ? { number: p.request.number, client: p.request.client } : null,
    isGpsTracked: p.isGpsTracked,
    point:
      p.last?.kind === "CITY" && p.last.lat !== null && p.last.lng !== null
        ? {
            lat: p.last.lat,
            lng: p.last.lng,
            accuracy: p.last.accuracy ?? null,
            time: time(p.last.at),
            source: p.last.source,
          }
        : null,
    route: routes[idx].points.map((pt) => [pt.lat, pt.lng] as [number, number]),
    totalKm: routes[idx].totalKm,
  }));

  return { office, clients: [...byClient.values()], out, updatedAt: time(now) };
}

export type CityMapData = Awaited<ReturnType<typeof cityMap>>;
