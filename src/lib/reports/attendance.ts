import ExcelJS from "exceljs";
import type { EventType, OutReason } from "@prisma/client";
import { officeAndOutMinutes, officeClock } from "../attendance/time";

// Отчёт по посещаемости: лист «Сводка» и лист «По дням».

export type ReportWorkDay = {
  date: Date; // @db.Date
  firstInAt: Date;
  endedAt: Date | null;
  lateMinutes: number;
  isLate: boolean;
  employee: { id: string; firstName: string; lastName: string };
  events: { type: EventType; reason: OutReason | null; at: Date }[];
};

export type DailyRow = {
  employeeId: string;
  date: string;
  employee: string;
  firstIn: Date;
  end: Date | null; // null — день ещё не закрыт
  lateMinutes: number;
  officeMinutes: number;
  outMinutes: number;
};

export type SummaryRow = { employee: string; days: number; lateCount: number; officeMinutes: number; outMinutes: number };

export function buildReportRows(days: ReportWorkDay[], employees: { id: string; firstName: string; lastName: string }[], now = new Date()) {
  const name = (e: { firstName: string; lastName: string }) => `${e.lastName} ${e.firstName}`;

  const daily: DailyRow[] = days
    .map((d) => {
      // Незакрытый день считаем до последней отметки, а сегодняшний — до текущего момента.
      const lastEvent = d.events.reduce((max, e) => (e.at > max ? e.at : max), d.firstInAt);
      const isToday = officeClock(now).date === d.date.toISOString().slice(0, 10);
      const until = d.endedAt ?? (isToday ? now : lastEvent);
      return {
        employeeId: d.employee.id,
        date: d.date.toISOString().slice(0, 10),
        employee: name(d.employee),
        firstIn: d.firstInAt,
        end: d.endedAt,
        lateMinutes: d.isLate ? d.lateMinutes : 0,
        ...officeAndOutMinutes(d.firstInAt, until, d.events),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.employee.localeCompare(b.employee, "ru"));

  const summary: SummaryRow[] = employees
    .map((e) => {
      const rows = daily.filter((r) => r.employeeId === e.id);
      return {
        employee: name(e),
        days: rows.length,
        lateCount: rows.filter((r) => r.lateMinutes > 0).length,
        officeMinutes: rows.reduce((s, r) => s + r.officeMinutes, 0),
        outMinutes: rows.reduce((s, r) => s + r.outMinutes, 0),
      };
    })
    .sort((a, b) => a.employee.localeCompare(b.employee, "ru"));

  return { daily, summary };
}

// Защита от Formula Injection (CWE-1236):
// Если строковое значение начинается со знаков формул (=, +, -, @, табуляция),
// предваряем его апострофом ', чтобы Excel трактовал его строго как текст.
export function sanitizeExcelCell<T>(value: T): T {
  if (typeof value === "string" && /^[\s]*[=+\-@\t\r]/.test(value)) {
    return `'${value}` as T;
  }
  return value;
}

type T = (key: string, values?: Record<string, string>) => string;

const MINUTES_PER_DAY = 24 * 60;
const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
const LATE_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };

// Excel-время: доля суток. Так часы можно складывать формулами, а показываются они как «7 ч 48 мин».
const duration = (minutes: number) => minutes / MINUTES_PER_DAY;
const clockTime = (d: Date) => officeClock(d).seconds / 86400;

function addSheet(wb: ExcelJS.Workbook, name: string, title: string, columns: { header: string; width: number; numFmt?: string }[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 2 }] });
  ws.columns = columns.map((c) => ({ width: c.width, style: c.numFmt ? { numFmt: c.numFmt } : {} }));
  ws.getCell("A1").value = title;
  ws.getCell("A1").font = { bold: true, size: 13 };
  const header = ws.getRow(2);
  columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true };
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: columns.length } };
  return ws;
}

export async function writeReportXlsx(rows: ReturnType<typeof buildReportRows>, period: { from: string; to: string }, t: T) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Офис-CRM";
  const hoursFmt = t("durationFormat");
  const title = t("fileTitle", period);

  const summary = addSheet(wb, t("sheetSummary"), title, [
    { header: t("colEmployee"), width: 28 },
    { header: t("colDays"), width: 14 },
    { header: t("colLateCount"), width: 14 },
    { header: t("colOfficeHours"), width: 18, numFmt: hoursFmt },
    { header: t("colOutHours"), width: 18, numFmt: hoursFmt },
  ]);
  for (const r of rows.summary) {
    summary.addRow([sanitizeExcelCell(r.employee), r.days, r.lateCount, duration(r.officeMinutes), duration(r.outMinutes)]);
  }

  const daily = addSheet(wb, t("sheetDaily"), title, [
    { header: t("colDate"), width: 12 },
    { header: t("colEmployee"), width: 28 },
    { header: t("colIn"), width: 10, numFmt: "hh:mm" },
    { header: t("colOut"), width: 10, numFmt: "hh:mm" },
    { header: t("colLateMinutes"), width: 14 },
    { header: t("colOfficeHours"), width: 18, numFmt: hoursFmt },
    { header: t("colOutHours"), width: 18, numFmt: hoursFmt },
  ]);
  for (const r of rows.daily) {
    const row = daily.addRow([
      r.date,
      sanitizeExcelCell(r.employee),
      clockTime(r.firstIn),
      r.end ? clockTime(r.end) : t("notClosed"),
      r.lateMinutes,
      duration(r.officeMinutes),
      duration(r.outMinutes),
    ]);
    if (r.lateMinutes > 0) row.eachCell((cell) => (cell.fill = LATE_FILL));
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
