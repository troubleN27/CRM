import { describe, expect, it } from "vitest";
import { imageSize, rectFromPoints, sniffImageType, toFraction } from "./office-plan";
import { testDesks, testZones } from "./test-plan";
import { deskSchema } from "./validation";

describe("toFraction", () => {
  it("одна и та же точка картинки даёт одинаковые доли при любом размере", () => {
    const small = toFraction(100 + 50, 20 + 32, { left: 100, top: 20, width: 500, height: 320 });
    const big = toFraction(0 + 100, 0 + 64, { left: 0, top: 0, width: 1000, height: 640 });
    expect(small).toEqual({ x: 0.1, y: 0.1 });
    expect(big).toEqual(small);
  });
  it("клик за краем прижимается к 0…1", () => {
    expect(toFraction(-10, 999, { left: 0, top: 0, width: 100, height: 100 })).toEqual({ x: 0, y: 1 });
  });
});

describe("rectFromPoints", () => {
  it("зону можно тянуть в любую сторону", () => {
    expect(rectFromPoints({ x: 0.5, y: 0.6 }, { x: 0.2, y: 0.1 })).toEqual({ x: 0.2, y: 0.1, width: 0.3, height: 0.5 });
  });
});

describe("sniffImageType и imageSize", () => {
  it("PNG: тип и размер из заголовка", () => {
    const png = new Uint8Array(24);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    new DataView(png.buffer).setUint32(16, 1200);
    new DataView(png.buffer).setUint32(20, 800);
    expect(sniffImageType(png)).toBe("image/png");
    expect(imageSize(png, "image/png")).toEqual({ width: 1200, height: 800 });
  });
  it("SVG и прочее не принимаем", () => {
    expect(sniffImageType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
  });
});

describe("тестовый план", () => {
  it("13 мест и 3 зоны, все внутри картинки и проходят проверку", () => {
    expect(testDesks).toHaveLength(13);
    expect(testZones).toHaveLength(3);
    for (const d of testDesks) expect(deskSchema.safeParse({ ...d, employeeId: "" }).success).toBe(true);
    for (const z of testZones) expect(z.x + z.width).toBeLessThanOrEqual(1);
  });
});
