// Дата «сегодня» в часовом поясе офиса, в виде YYYY-MM-DD.
export function todayInOffice(now = new Date()): string {
  const timeZone = process.env.OFFICE_TIMEZONE || "America/Los_Angeles";
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
}

// Время ЧЧ:ММ в часовом поясе офиса.
export function formatOfficeTime(d: Date, locale: string): string {
  const timeZone = process.env.OFFICE_TIMEZONE || "America/Los_Angeles";
  return new Intl.DateTimeFormat(locale, { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
}

// Дата из БД (@db.Date приходит как полночь UTC) → YYYY-MM-DD.
export function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}
