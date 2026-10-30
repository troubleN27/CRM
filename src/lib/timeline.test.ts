import { describe, expect, it } from "vitest";
import { daySegments, periodDates } from "./timeline";

const LA = "America/Los_Angeles";
const at = (hhmm: string) => new Date(`2026-10-23T${hhmm}:00-07:00`);
const m = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

describe("daySegments", () => {
  it("пример 09:12 / обед 13–14 / 18:00 → офис, обед, офис", () => {
    const events = [
      { type: "IN" as const, reason: null, at: at("09:12") },
      { type: "OUT" as const, reason: "LUNCH" as const, at: at("13:00") },
      { type: "IN" as const, reason: null, at: at("14:00") },
      { type: "OUT" as const, reason: "END_OF_DAY" as const, at: at("18:00") },
    ];
    expect(daySegments(events, at("18:00"), LA)).toEqual([
      { kind: "office", start: m("09:12"), end: m("13:00") },
      { kind: "LUNCH", start: m("13:00"), end: m("14:00") },
      { kind: "office", start: m("14:00"), end: m("18:00") },
    ]);
  });

  it("незакрытый день тянется до текущего момента", () => {
    const events = [
      { type: "IN" as const, reason: null, at: at("09:00") },
      { type: "OUT" as const, reason: "CLIENT_VISIT" as const, at: at("11:00") },
    ];
    expect(daySegments(events, at("12:30"), LA)).toEqual([
      { kind: "office", start: m("09:00"), end: m("11:00") },
      { kind: "CLIENT_VISIT", start: m("11:00"), end: m("12:30") },
    ]);
  });
});

describe("periodDates", () => {
  it("неделя — пн–пт той недели, в которую попала дата", () => {
    expect(periodDates("week", "2026-10-23")).toEqual(["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"]);
  });
  it("месяц — все дни месяца", () => {
    const days = periodDates("month", "2026-02-10");
    expect(days[0]).toBe("2026-02-01");
    expect(days).toHaveLength(28);
  });
});
