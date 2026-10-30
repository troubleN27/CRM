import { describe, expect, it } from "vitest";
import { zoneAt } from "./agent";
import { testZones } from "./test-plan";

describe("zoneAt — в какой зоне плана человек", () => {
  it("точка на кухне тестового плана → «Кухня»", () => {
    expect(zoneAt({ x: 0.8, y: 0.75 }, testZones)?.name).toBe("Кухня");
  });
  it("точка в переговорной → «Переговорная»", () => {
    expect(zoneAt({ x: 0.8, y: 0.2 }, testZones)?.name).toBe("Переговорная");
  });
  it("если зоны вложены — берётся самая маленькая", () => {
    const zones = [
      { name: "Опенспейс", type: "WORK" as const, x: 0, y: 0, width: 1, height: 1 },
      { name: "Кухня", type: "KITCHEN" as const, x: 0.4, y: 0.4, width: 0.2, height: 0.2 },
    ];
    expect(zoneAt({ x: 0.5, y: 0.5 }, zones)?.name).toBe("Кухня");
  });
  it("вне всех зон → null", () => {
    expect(zoneAt({ x: 0.99, y: 0.01 }, testZones)).toBeNull();
  });
});
