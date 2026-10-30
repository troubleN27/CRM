import { z } from "zod";
import { bearerMatches } from "./api-key";
import { workDayDate } from "./attendance/time";
import { db } from "./db";

// Общий приём позиций. Сюда пишут имитация, будущие датчики в офисе и телефон сотрудника.
// Правило приватности (CLAUDE.md): точка сохраняется только между «Я пришёл» и «Закончить работу».
// Точка на плане — только у тех, кто «в офисе», точка на карте — только у тех, кто «вне офиса».

export const positionSchema = z.discriminatedUnion("kind", [
  z.object({ employeeId: z.string().min(1), kind: z.literal("OFFICE"), x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
  z.object({
    employeeId: z.string().min(1),
    kind: z.literal("CITY"),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracy: z.number().min(0).max(100000).optional(),
  }),
]);

export const positionsBatchSchema = z.object({
  source: z.string().trim().min(1).max(40).default("device"),
  positions: z.array(positionSchema).min(1).max(500),
});

export type PositionInput = z.infer<typeof positionSchema>;

// Ключ устройств (имитация, датчики) из .env.
export function isDeviceKey(header: string | null): boolean {
  return bearerMatches(header, process.env.POSITIONS_API_KEY);
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export type RoutePoint = { lat: number; lng: number; at: string; accuracy: number | null };

export async function employeeTodayRoute(employeeId: string, now = new Date()) {
  const day = await db.workDay.findUnique({
    where: { employeeId_date: { employeeId, date: workDayDate(now) } },
    include: {
      locations: {
        where: { kind: "CITY" },
        orderBy: { at: "asc" },
        select: { lat: true, lng: true, accuracy: true, at: true },
      },
    },
  });
  if (!day) return { points: [] as RoutePoint[], totalKm: 0 };
  const raw = day.locations.filter((p): p is { lat: number; lng: number; accuracy: number | null; at: Date } => p.lat !== null && p.lng !== null);
  let totalKm = 0;
  for (let i = 1; i < raw.length; i++) {
    totalKm += haversineKm(raw[i - 1].lat, raw[i - 1].lng, raw[i].lat, raw[i].lng);
  }
  const points: RoutePoint[] = raw.map((p) => ({
    lat: p.lat,
    lng: p.lng,
    accuracy: p.accuracy,
    at: p.at.toISOString(),
  }));
  return { points, totalKm: Number(totalKm.toFixed(2)) };
}

export async function recordPositions(source: string, positions: PositionInput[], now = new Date()) {
  const ids = [...new Set(positions.map((p) => p.employeeId))];
  const days = await db.workDay.findMany({
    where: { employeeId: { in: ids }, date: workDayDate(now), endedAt: null },
    include: { employee: { select: { status: true, isActive: true, isGpsTracked: true } } },
  });
  const byEmployee = new Map(days.map((d) => [d.employeeId, d]));

  const rows = [];
  let rejected = 0;
  for (const p of positions) {
    const day = byEmployee.get(p.employeeId);
    const status = day?.employee.isActive ? day.employee.status : null;
    const isGpsTracked = day?.employee.isGpsTracked ?? false;
    const ok = isGpsTracked
      ? p.kind === "CITY" || p.kind === "OFFICE"
      : (p.kind === "OFFICE" && status === "IN_OFFICE") || (p.kind === "CITY" && status === "OUT_OF_OFFICE");
    if (!day || !ok) {
      rejected++;
      continue;
    }
    rows.push(
      p.kind === "OFFICE"
        ? { workDayId: day.id, kind: "OFFICE" as const, x: p.x, y: p.y, source, at: now }
        : { workDayId: day.id, kind: "CITY" as const, lat: p.lat, lng: p.lng, accuracy: p.accuracy, source, at: now },
    );
  }
  if (rows.length) await db.locationPoint.createMany({ data: rows });
  return { accepted: rows.length, rejected };
}

// Кто сейчас на работе и где — для живого плана, карты и имитации.
export async function livePeople(now = new Date()) {
  const days = await db.workDay.findMany({
    where: { date: workDayDate(now), endedAt: null, employee: { isActive: true } },
    include: {
      employee: { include: { desk: true } },
      events: { orderBy: { at: "desc" }, take: 1, include: { request: { include: { client: true } } } },
      locations: { orderBy: { at: "desc" }, take: 1 },
    },
  });
  return days.map((d) => {
    const e = d.employee;
    const lastEvent = d.events[0];
    const last = d.locations[0];
    return {
      employeeId: e.id,
      name: `${e.firstName} ${e.lastName}`,
      initials: `${e.firstName[0]}${e.lastName[0]}`,
      status: e.status,
      isGpsTracked: e.isGpsTracked,
      desk: e.desk ? { code: e.desk.code, x: e.desk.x, y: e.desk.y } : null,
      outReason: e.status === "OUT_OF_OFFICE" ? (lastEvent?.reason ?? null) : null,
      outSince: e.status === "OUT_OF_OFFICE" ? (lastEvent?.at ?? null) : null,
      request:
        e.status === "OUT_OF_OFFICE" && lastEvent?.request
          ? { number: lastEvent.request.number, client: lastEvent.request.client.name, lat: lastEvent.request.client.lat, lng: lastEvent.request.client.lng }
          : null,
      last: last
        ? { kind: last.kind, x: last.x, y: last.y, lat: last.lat, lng: last.lng, accuracy: last.accuracy, at: last.at, source: last.source }
        : null,
      // Последняя отметка: приход, возвращение или выход.
      lastMark: lastEvent
        ? {
            kind: lastEvent.type === "OUT" ? ("out" as const) : lastEvent.at.getTime() === d.firstInAt.getTime() ? ("checkIn" as const) : ("back" as const),
            at: lastEvent.at,
          }
        : null,
    };
  });
}

export type LivePerson = Awaited<ReturnType<typeof livePeople>>[number];
