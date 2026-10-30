import { describe, expect, it } from "vitest";
import { isPastGrace, lateness, officeAndOutMinutes, officeClock, officeTimeToDate, workDayDate, workedMinutes } from "./time";

const LA = "America/Los_Angeles";
// 26 октября 2026 — летнее время, LA = UTC−7.
const at = (hhmmss: string, date = "2026-10-26", offset = "-07:00") => new Date(`${date}T${hhmmss}${offset}`);

describe("lateness: 09:00 + 5 минут", () => {
  it.each([
    ["08:50:00", false, 0],
    ["09:05:00", false, 0],
    ["09:05:59", false, 0],
    ["09:06:00", true, 6],
    ["10:30:00", true, 90],
  ])("приход в %s → опоздание %s, %i мин", (time, isLate, minutes) => {
    expect(lateness(at(time), LA)).toEqual({ isLate, lateMinutes: minutes });
  });

  it("зимнее время (UTC−8) считается так же", () => {
    expect(lateness(at("09:06:00", "2026-12-01", "-08:00"), LA)).toEqual({ isLate: true, lateMinutes: 6 });
    expect(lateness(at("09:05:59", "2026-12-01", "-08:00"), LA)).toEqual({ isLate: false, lateMinutes: 0 });
  });
});

describe("isPastGrace", () => {
  it("до 09:05:59 — ещё нет, с 09:06 — да", () => {
    expect(isPastGrace(at("09:05:59"), LA)).toBe(false);
    expect(isPastGrace(at("09:06:00"), LA)).toBe(true);
  });
});

describe("дата рабочего дня по часовому поясу офиса", () => {
  it("23:30 в LA — это ещё тот же день, хотя в UTC уже следующий", () => {
    expect(officeClock(at("23:30:00"), LA).date).toBe("2026-10-26");
    expect(workDayDate(at("23:30:00"), LA).toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });
});

describe("officeTimeToDate", () => {
  it("летом и зимой даёт правильный момент", () => {
    expect(officeTimeToDate("2026-10-26", 9, 12, LA).toISOString()).toBe("2026-10-26T16:12:00.000Z");
    expect(officeTimeToDate("2026-12-01", 9, 12, LA).toISOString()).toBe("2026-12-01T17:12:00.000Z");
  });
});

describe("officeAndOutMinutes — пример из задания", () => {
  it("приход 09:12, обед 13:00–14:00, уход 18:00 → опоздание 12 мин, в офисе 7 ч 48 мин, вне офиса 1 ч", () => {
    const events = [
      { type: "IN" as const, reason: null, at: at("09:12:00") },
      { type: "OUT" as const, reason: "LUNCH" as const, at: at("13:00:00") },
      { type: "IN" as const, reason: null, at: at("14:00:00") },
      { type: "OUT" as const, reason: "END_OF_DAY" as const, at: at("18:00:00") },
    ];
    expect(lateness(at("09:12:00"), LA)).toEqual({ isLate: true, lateMinutes: 12 });
    expect(officeAndOutMinutes(at("09:12:00"), at("18:00:00"), events)).toEqual({ officeMinutes: 7 * 60 + 48, outMinutes: 60 });
  });

  it("выезд на заявку тоже «вне офиса»; ушёл домой прямо с выезда — считается до ухода", () => {
    const events = [
      { type: "IN" as const, reason: null, at: at("09:00:00") },
      { type: "OUT" as const, reason: "CLIENT_VISIT" as const, at: at("16:00:00") },
      { type: "OUT" as const, reason: "END_OF_DAY" as const, at: at("18:00:00") },
    ];
    expect(officeAndOutMinutes(at("09:00:00"), at("18:00:00"), events)).toEqual({ officeMinutes: 7 * 60, outMinutes: 120 });
  });
});

describe("workedMinutes", () => {
  it("пример из SPEC: 09:00–18:00, обед час, выезд не вычитается → 8 ч", () => {
    const events = [
      { type: "IN" as const, reason: null, at: at("09:00:00") },
      { type: "OUT" as const, reason: "LUNCH" as const, at: at("13:00:00") },
      { type: "IN" as const, reason: null, at: at("14:00:00") },
      { type: "OUT" as const, reason: "CLIENT_VISIT" as const, at: at("15:00:00") },
      { type: "IN" as const, reason: null, at: at("16:30:00") },
      { type: "OUT" as const, reason: "END_OF_DAY" as const, at: at("18:00:00") },
    ];
    expect(workedMinutes(at("09:00:00"), at("18:00:00"), events)).toBe(8 * 60);
  });

  it("без перерывов — просто от прихода до ухода", () => {
    expect(workedMinutes(at("09:12:00"), at("18:03:00"), [])).toBe(8 * 60 + 51);
  });
});
