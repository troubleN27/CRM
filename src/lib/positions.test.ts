import { describe, expect, it } from "vitest";
import { haversineKm } from "./positions";

describe("haversineKm", () => {
  it("расстояние между одной и той же точкой равно 0", () => {
    expect(haversineKm(41.3111, 69.2797, 41.3111, 69.2797)).toBe(0);
  });

  it("вычисляет расстояние между двумя точками в Ташкенте", () => {
    // Центр Ташкента (41.3111, 69.2797) и Юнусабад (41.3655, 69.2865) ≈ 6.1 км
    const dist = haversineKm(41.3111, 69.2797, 41.3655, 69.2865);
    expect(dist).toBeGreaterThan(5.5);
    expect(dist).toBeLessThan(6.8);
  });

  it("симметрично в обоих направлениях", () => {
    const d1 = haversineKm(41.31, 69.28, 41.33, 69.30);
    const d2 = haversineKm(41.33, 69.30, 41.31, 69.28);
    expect(d1).toBeCloseTo(d2, 6);
  });
});
