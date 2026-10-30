import type { EventType, OutReason } from "@prisma/client";
import { officeAndOutMinutes, officeClock } from "./attendance/time";
import { db } from "./db";

// Ресурсное планирование: кто когда был в офисе и вне его (диаграмма Ганта).

export type SegmentKind = "office" | "LUNCH" | "CLIENT_VISIT" | "PERSONAL";
export type Segment = { kind: SegmentKind; start: number; end: number }; // минуты от полуночи по времени офиса

type Event = { type: EventType; reason: OutReason | null; at: Date };

// Отрезки рабочего дня: «в офисе» от прихода/возвращения до выхода, «вне офиса» — от выхода до возвращения.
export function daySegments(events: Event[], end: Date, timeZone?: string): Segment[] {
  const minute = (d: Date) => Math.round(officeClock(d, timeZone).seconds / 60);
  const sorted = [...events].sort((a, b) => a.at.getTime() - b.at.getTime());
  const out: Segment[] = [];
  let open: { kind: SegmentKind; start: number } | null = null;
  for (const e of sorted) {
    if (e.at > end) break;
    const m = minute(e.at);
    if (open) out.push({ ...open, end: m });
    if (e.type === "IN") open = { kind: "office", start: m };
    else open = e.reason && e.reason !== "END_OF_DAY" ? { kind: e.reason, start: m } : null;
  }
  if (open) out.push({ ...open, end: Math.max(open.start, minute(end)) });
  return out.filter((s) => s.end > s.start);
}

export type TimelineView = "day" | "week" | "month";

// Даты периода (YYYY-MM-DD): день, неделя пн–пт, месяц целиком.
export function periodDates(view: TimelineView, date: string): string[] {
  const d = new Date(`${date}T00:00:00Z`);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  if (view === "day") return [date];
  if (view === "week") {
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return Array.from({ length: 5 }, (_, i) => {
      const x = new Date(monday);
      x.setUTCDate(monday.getUTCDate() + i);
      return iso(x);
    });
  }
  const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const days = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  return Array.from({ length: days }, (_, i) => iso(new Date(first.getTime() + i * 86_400_000)));
}

export async function timelineData(view: TimelineView, date: string, now = new Date()) {
  const dates = periodDates(view, date);
  const today = officeClock(now).date;
  const [employees, workDays] = await Promise.all([
    db.employee.findMany({ where: { isActive: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    db.workDay.findMany({
      where: { date: { gte: new Date(`${dates[0]}T00:00:00Z`), lte: new Date(`${dates.at(-1)}T00:00:00Z`) } },
      include: { events: true },
    }),
  ]);

  const rows = employees.map((e) => {
    const days = dates.map((d) => {
      const wd = workDays.find((w) => w.employeeId === e.id && w.date.toISOString().slice(0, 10) === d);
      if (!wd) return { date: d, segments: [] as Segment[], officeMinutes: 0, outMinutes: 0, late: false, open: false };
      const lastEvent = wd.events.reduce((m, x) => (x.at > m ? x.at : m), wd.firstInAt);
      const until = wd.endedAt ?? (d === today ? now : lastEvent);
      return {
        date: d,
        segments: view === "day" ? daySegments(wd.events, until) : [],
        ...officeAndOutMinutes(wd.firstInAt, until, wd.events),
        late: wd.isLate,
        open: !wd.endedAt,
      };
    });
    return { employeeId: e.id, name: `${e.lastName} ${e.firstName}`, position: e.position, days };
  });

  return { view, date, dates, today, nowMinute: Math.round(officeClock(now).seconds / 60), rows };
}

export type TimelineData = Awaited<ReturnType<typeof timelineData>>;
