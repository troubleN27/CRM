import type { EventType, OutReason } from "@prisma/client";
import { LATE_GRACE_MINUTES, officeTimeZone, WORKDAY_START } from "./config";

// Дата (YYYY-MM-DD) и секунды от полуночи в часовом поясе офиса.
export function officeClock(at: Date, timeZone = officeTimeZone()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    seconds: Number(get("hour")) * 3600 + Number(get("minute")) * 60 + Number(get("second")),
  };
}

// Дата рабочего дня для колонки @db.Date.
export function workDayDate(at: Date, timeZone = officeTimeZone()): Date {
  return new Date(`${officeClock(at, timeZone).date}T00:00:00Z`);
}

const START = WORKDAY_START.hour * 3600 + WORKDAY_START.minute * 60;
// Первая секунда опоздания: 09:06:00.
const LATE_FROM = START + (LATE_GRACE_MINUTES + 1) * 60;

// Опоздание по первому приходу: минуты считаются от 09:00 (09:06 → 6, 10:30 → 90).
export function lateness(firstIn: Date, timeZone = officeTimeZone()) {
  const { seconds } = officeClock(firstIn, timeZone);
  const isLate = seconds >= LATE_FROM;
  return { isLate, lateMinutes: isLate ? Math.floor((seconds - START) / 60) : 0 };
}

// Прошло ли 09:05 — после этого неотметившихся показываем админу как опаздывающих.
export function isPastGrace(now: Date, timeZone = officeTimeZone()) {
  return officeClock(now, timeZone).seconds >= LATE_FROM;
}

// Местное время офиса → момент в UTC (для демо-данных).
export function officeTimeToDate(date: string, hour: number, minute: number, timeZone = officeTimeZone()): Date {
  const [y, m, d] = date.split("-").map(Number);
  let t = Date.UTC(y, m - 1, d, hour, minute);
  // Две поправки на смещение пояса (с учётом перехода на летнее время).
  for (let i = 0; i < 2; i++) {
    const c = officeClock(new Date(t), timeZone);
    const dayShift = c.date === date ? 0 : c.date < date ? 86400 : -86400;
    t += (dayShift + hour * 3600 + minute * 60 - c.seconds) * 1000;
  }
  return new Date(t);
}

type Event = { type: EventType; reason: OutReason | null; at: Date };

// Для отчёта: сколько минут человек был в офисе и вне офиса за рабочий день.
// Вне офиса — от каждого «Вышел» (обед, выезд, личное) до следующего «Пришёл» (или до конца дня).
// В офисе — всё остальное время между первым приходом и уходом.
export function officeAndOutMinutes(firstIn: Date, end: Date, events: Event[]) {
  let outMs = 0;
  let outStart: Date | null = null;
  for (const e of [...events].sort((a, b) => a.at.getTime() - b.at.getTime())) {
    if (e.at > end) break;
    if (e.type === "OUT" && e.reason !== "END_OF_DAY") outStart ??= e.at;
    else if (e.type === "IN" && outStart) {
      outMs += e.at.getTime() - outStart.getTime();
      outStart = null;
    }
  }
  if (outStart) outMs += end.getTime() - outStart.getTime();
  const totalMin = Math.max(0, Math.round((end.getTime() - firstIn.getTime()) / 60000));
  const outMinutes = Math.round(outMs / 60000);
  return { officeMinutes: Math.max(0, totalMin - outMinutes), outMinutes };
}

// Отработано: от первого прихода до ухода минус обед и личное.
// Выезд на заявку — рабочее время.
export function workedMinutes(firstIn: Date, end: Date, events: Event[]): number {
  let breakMs = 0;
  let breakStart: Date | null = null;
  for (const e of [...events].sort((a, b) => a.at.getTime() - b.at.getTime())) {
    if (e.type === "OUT" && (e.reason === "LUNCH" || e.reason === "PERSONAL")) breakStart = e.at;
    else if (e.type === "IN" && breakStart) {
      breakMs += e.at.getTime() - breakStart.getTime();
      breakStart = null;
    }
  }
  if (breakStart) breakMs += end.getTime() - breakStart.getTime();
  return Math.max(0, Math.floor((end.getTime() - firstIn.getTime() - breakMs) / 60000));
}
