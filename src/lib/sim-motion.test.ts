import { describe, expect, it } from "vitest";
import { randomInRect, randomNear, stepToward } from "./sim-motion";

describe("stepToward", () => {
  it("идёт к цели шагом не длиннее заданного", () => {
    const { pos, arrived } = stepToward({ x: 0, y: 0 }, { x: 1, y: 0 }, 0.1);
    expect(arrived).toBe(false);
    expect(pos.x).toBeCloseTo(0.1);
    expect(pos.y).toBe(0);
  });
  it("если цель ближе шага — встаёт точно в неё", () => {
    expect(stepToward({ x: 0.5, y: 0.5 }, { x: 0.52, y: 0.5 }, 0.1)).toEqual({ pos: { x: 0.52, y: 0.5 }, arrived: true });
  });
});

describe("randomInRect", () => {
  it("точка всегда внутри зоны с отступом", () => {
    const zone = { x: 0.65, y: 0.5, width: 0.33, height: 0.47 };
    for (const r of [0, 0.5, 0.999]) {
      const p = randomInRect(zone, () => r);
      expect(p.x).toBeGreaterThanOrEqual(zone.x);
      expect(p.x).toBeLessThanOrEqual(zone.x + zone.width);
      expect(p.y).toBeGreaterThanOrEqual(zone.y);
      expect(p.y).toBeLessThanOrEqual(zone.y + zone.height);
    }
  });
});

describe("randomNear", () => {
  it("не дальше радиуса по каждой оси", () => {
    const p = randomNear({ x: 41.3, y: 69.28 }, 0.01, () => 1);
    expect(p.x).toBeCloseTo(41.31);
    expect(p.y).toBeCloseTo(69.29);
  });
});
