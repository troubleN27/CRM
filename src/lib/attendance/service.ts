import { Prisma } from "@prisma/client";
import { db } from "../db";
import { lateness, workDayDate, workedMinutes } from "./time";

export type AttendanceResult =
  | { ok: true; isLate?: boolean; lateMinutes?: number }
  | { ok: false; error: "alreadyIn" | "dayEnded" | "notIn" | "notInOffice" | "notOut" | "badRequest" };

export type OutReasonInput = "LUNCH" | "CLIENT_VISIT" | "PERSONAL";

// Открытый сегодняшний день с отметками по порядку.
async function openToday(tx: Prisma.TransactionClient, employeeId: string, now: Date) {
  const day = await tx.workDay.findUnique({
    where: { employeeId_date: { employeeId, date: workDayDate(now) } },
    include: { events: { orderBy: { at: "asc" } } },
  });
  return day && !day.endedAt ? day : null;
}

// «Вышел»: обед, выезд на заявку или личное. Рабочий день продолжается.
export async function goOut(employeeId: string, reason: OutReasonInput, requestId: string | null, now = new Date()): Promise<AttendanceResult> {
  return db.$transaction(async (tx) => {
    const day = await openToday(tx, employeeId, now);
    if (!day) return { ok: false, error: "notIn" } as const;
    if (day.events.at(-1)?.type !== "IN") return { ok: false, error: "notInOffice" } as const;
    if (requestId) {
      // Выезд можно привязать только к своей незакрытой заявке.
      const req = await tx.request.findFirst({ where: { id: requestId, assigneeId: employeeId, status: { not: "DONE" } } });
      if (!req || reason !== "CLIENT_VISIT") return { ok: false, error: "badRequest" } as const;
    }
    await tx.attendanceEvent.create({ data: { workDayId: day.id, type: "OUT", reason, requestId, at: now } });
    await tx.employee.update({ where: { id: employeeId }, data: { status: "OUT_OF_OFFICE" } });
    return { ok: true } as const;
  });
}

// «Вернулся в офис».
export async function comeBack(employeeId: string, now = new Date()): Promise<AttendanceResult> {
  return db.$transaction(async (tx) => {
    const day = await openToday(tx, employeeId, now);
    if (!day) return { ok: false, error: "notIn" } as const;
    if (day.events.at(-1)?.type !== "OUT") return { ok: false, error: "notOut" } as const;
    await tx.attendanceEvent.create({ data: { workDayId: day.id, type: "IN", at: now } });
    await tx.employee.update({ where: { id: employeeId }, data: { status: "IN_OFFICE" } });
    return { ok: true } as const;
  });
}

// Сегодняшний рабочий день сотрудника (или null, если ещё не отметился).
export function todayWorkDay(employeeId: string, now = new Date()) {
  return db.workDay.findUnique({ where: { employeeId_date: { employeeId, date: workDayDate(now) } } });
}

// «Я пришёл»: создаёт рабочий день, время — серверное.
export async function checkIn(employeeId: string, now = new Date()): Promise<AttendanceResult> {
  const date = workDayDate(now);
  try {
    return await db.$transaction(async (tx) => {
      const existing = await tx.workDay.findUnique({ where: { employeeId_date: { employeeId, date } } });
      if (existing) return { ok: false, error: existing.endedAt ? "dayEnded" : "alreadyIn" } as const;

      // Забытые незакрытые дни закрываем временем последней отметки.
      const open = await tx.workDay.findMany({ where: { employeeId, endedAt: null }, include: { events: true } });
      for (const w of open) {
        const last = w.events.reduce((max, e) => (e.at > max ? e.at : max), w.firstInAt);
        await tx.workDay.update({
          where: { id: w.id },
          data: { endedAt: last, endType: "AUTO_CLOSED", workedMinutes: workedMinutes(w.firstInAt, last, w.events) },
        });
      }

      const late = lateness(now);
      await tx.workDay.create({
        data: { employeeId, date, firstInAt: now, ...late, events: { create: { type: "IN", at: now } } },
      });
      await tx.employee.update({ where: { id: employeeId }, data: { status: "IN_OFFICE" } });
      return { ok: true, ...late } as const;
    });
  } catch (e) {
    // Двойной клик: второй запрос упрётся в уникальность (сотрудник, дата).
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, error: "alreadyIn" };
    throw e;
  }
}

// «Закончить работу»: запоминает время ухода и закрывает рабочий день.
export async function endWork(employeeId: string, now = new Date()): Promise<AttendanceResult> {
  return db.$transaction(async (tx) => {
    const day = await tx.workDay.findFirst({
      where: { employeeId, endedAt: null },
      orderBy: { firstInAt: "desc" },
      include: { events: true },
    });
    if (!day) return { ok: false, error: "notIn" } as const;

    const events = [...day.events, { type: "OUT" as const, reason: "END_OF_DAY" as const, at: now }];
    const closed = await tx.workDay.updateMany({
      where: { id: day.id, endedAt: null },
      data: { endedAt: now, endType: "END_OF_DAY", workedMinutes: workedMinutes(day.firstInAt, now, events) },
    });
    if (closed.count === 0) return { ok: false, error: "notIn" } as const;

    await tx.attendanceEvent.create({ data: { workDayId: day.id, type: "OUT", reason: "END_OF_DAY", at: now } });
    await tx.employee.update({ where: { id: employeeId }, data: { status: "OFF_WORK" } });
    return { ok: true } as const;
  });
}
