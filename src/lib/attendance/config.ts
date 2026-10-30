// Правила рабочего дня (CLAUDE.md, «Правила учёта времени»). Менять только по запросу.
export const WORKDAY_START = { hour: 9, minute: 0 };

// Допуск: приход до 09:05:59 включительно — вовремя, с 09:06:00 — опоздание.
export const LATE_GRACE_MINUTES = 5;

export function officeTimeZone(): string {
  return process.env.OFFICE_TIMEZONE || "America/Los_Angeles";
}
