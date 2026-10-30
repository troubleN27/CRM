import { describe, expect, it } from "vitest";
import { generateQrSvg } from "./qr";

describe("generateQrSvg", () => {
  it("генерирует валидный SVG для URL", () => {
    const svg = generateQrSvg("https://192.168.1.100:3000/ru/login");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("viewBox=");
    expect(svg).toContain("path d=");
  });

  it("корректно генерирует для короткого и длинного текста", () => {
    const shortSvg = generateQrSvg("http://localhost:3000");
    const longSvg = generateQrSvg("https://example.com/very/long/path/with/parameters?auth=test&redirect=true");
    expect(shortSvg.length).toBeGreaterThan(100);
    expect(longSvg.length).toBeGreaterThan(100);
  });
});
