import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import ru from "../../../messages/ru.json";
import { buildReportRows, sanitizeExcelCell, writeReportXlsx, type ReportWorkDay } from "./attendance";

process.env.OFFICE_TIMEZONE = "America/Los_Angeles";
const at = (hhmm: string) => new Date(`2026-10-23T${hhmm}:00-07:00`);
const alice = { id: "e1", firstName: "Алиса", lastName: "Тестова" };
const ivan = { id: "e2", firstName: "Иван", lastName: "Пробный" };

// Пример из задания: приход 09:12, обед 13:00–14:00, уход 18:00.
const example: ReportWorkDay = {
  date: new Date("2026-10-23T00:00:00Z"),
  firstInAt: at("09:12"),
  endedAt: at("18:00"),
  isLate: true,
  lateMinutes: 12,
  employee: alice,
  events: [
    { type: "IN", reason: null, at: at("09:12") },
    { type: "OUT", reason: "LUNCH", at: at("13:00") },
    { type: "IN", reason: null, at: at("14:00") },
    { type: "OUT", reason: "END_OF_DAY", at: at("18:00") },
  ],
};

const t = (key: string, values?: Record<string, string>) =>
  Object.entries(values ?? {}).reduce((s, [k, v]) => s.replace(`{${k}}`, v), (ru.reports as Record<string, string>)[key]);

describe("отчёт: пример 09:12 / обед 13–14 / 18:00", () => {
  const rows = buildReportRows([example], [alice, ivan], new Date("2026-10-26T12:00:00Z"));

  it("по дням: опоздание 12 мин, в офисе 7 ч 48 мин, вне офиса 1 ч", () => {
    expect(rows.daily).toHaveLength(1);
    expect(rows.daily[0]).toMatchObject({ date: "2026-10-23", employee: "Тестова Алиса", lateMinutes: 12, officeMinutes: 468, outMinutes: 60 });
  });

  it("сводка: один день, одно опоздание; у Ивана без отметок — нули", () => {
    expect(rows.summary).toEqual([
      { employee: "Пробный Иван", days: 0, lateCount: 0, officeMinutes: 0, outMinutes: 0 },
      { employee: "Тестова Алиса", days: 1, lateCount: 1, officeMinutes: 468, outMinutes: 60 },
    ]);
  });

  it("файл .xlsx: два листа и правильные значения в ячейках", async () => {
    const file = await writeReportXlsx(rows, { from: "2026-10-23", to: "2026-10-23" }, t);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Сводка", "По дням"]);

    const daily = wb.getWorksheet("По дням")!;
    expect(daily.getRow(2).values).toEqual([undefined, "Дата", "Сотрудник", "Приход", "Уход", "Опоздание, мин", "Часов в офисе", "Часов вне офиса"]);
    const r = daily.getRow(3);
    expect(r.getCell(1).value).toBe("2026-10-23");
    expect(r.getCell(2).value).toBe("Тестова Алиса");
    // Ячейки времени и длительности ExcelJS при чтении отдаёт как дату от 1899-12-30 — переводим в минуты.
    const minutes = (v: unknown) =>
      Math.round(v instanceof Date ? (v.getTime() - Date.UTC(1899, 11, 30)) / 60000 : (v as number) * 1440);
    expect(minutes(r.getCell(3).value)).toBe(9 * 60 + 12); // 09:12
    expect(minutes(r.getCell(4).value)).toBe(18 * 60); // 18:00
    expect(r.getCell(5).value).toBe(12);
    expect(minutes(r.getCell(6).value)).toBe(7 * 60 + 48);
    expect(minutes(r.getCell(7).value)).toBe(60);
    expect(r.getCell(6).numFmt).toBe('[h]" ч "mm" мин"'); // в Excel видно «7 ч 48 мин»

    const s = wb.getWorksheet("Сводка")!.getRow(4);
    expect([s.getCell(1).value, s.getCell(2).value, s.getCell(3).value]).toEqual(["Тестова Алиса", 1, 1]);
    expect([minutes(s.getCell(4).value), minutes(s.getCell(5).value)]).toEqual([468, 60]);
  });
});

describe("защита от Formula Injection (CWE-1236)", () => {
  it("нейтрализует спецсимволы формул апострофом", () => {
    expect(sanitizeExcelCell("=1+1")).toBe("'=1+1");
    expect(sanitizeExcelCell("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
    expect(sanitizeExcelCell("-2+3")).toBe("'-2+3");
    expect(sanitizeExcelCell("@SUM(A1:A5)")).toBe("'@SUM(A1:A5)");
    expect(sanitizeExcelCell("\tformula")).toBe("'\tformula");
    expect(sanitizeExcelCell("  =SUM()")).toBe("'  =SUM()");
  });

  it("сохраняет безопасные строки и другие типы неизменными", () => {
    expect(sanitizeExcelCell("Иван Иванов")).toBe("Иван Иванов");
    expect(sanitizeExcelCell(12345)).toBe(12345);
    expect(sanitizeExcelCell(null)).toBe(null);
    expect(sanitizeExcelCell(undefined)).toBe(undefined);
  });

  it("экранирует вредоносное имя сотрудника в сгенерированном .xlsx файле", async () => {
    const maliciousEmployee = { id: "e-hack", firstName: "=calc()", lastName: "+User" };
    const maliciousDay: ReportWorkDay = {
      date: new Date("2026-10-23T00:00:00Z"),
      firstInAt: at("09:00"),
      endedAt: at("18:00"),
      isLate: false,
      lateMinutes: 0,
      employee: maliciousEmployee,
      events: [{ type: "IN", reason: null, at: at("09:00") }],
    };
    const rows = buildReportRows([maliciousDay], [maliciousEmployee], new Date("2026-10-26T12:00:00Z"));
    const file = await writeReportXlsx(rows, { from: "2026-10-23", to: "2026-10-23" }, t);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file as unknown as ArrayBuffer);
    const summaryCell = wb.getWorksheet("Сводка")!.getRow(3).getCell(1).value;
    const dailyCell = wb.getWorksheet("По дням")!.getRow(3).getCell(2).value;

    expect(summaryCell).toBe("'+User =calc()");
    expect(dailyCell).toBe("'+User =calc()");
  });
});
