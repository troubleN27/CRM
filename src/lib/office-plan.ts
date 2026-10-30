// Координаты на плане храним долями (0…1) от размера картинки:
// место остаётся на своём столе при любом размере экрана.

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// Точка клика → доли от прямоугольника картинки.
export function toFraction(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }) {
  return {
    x: clamp01((clientX - rect.left) / rect.width),
    y: clamp01((clientY - rect.top) / rect.height),
  };
}

// Прямоугольник по двум углам (тянуть можно в любую сторону).
export function rectFromPoints(a: { x: number; y: number }, b: { x: number; y: number }) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

type ZoneRect = { name: string; x: number; y: number; width: number; height: number };

// В какой зоне плана точка. Самую маленькую подходящую — переговорная внутри опенспейса важнее.
export function zoneAt<Z extends ZoneRect>(p: { x: number; y: number }, zones: Z[]): Z | null {
  return (
    zones
      .filter((z) => p.x >= z.x && p.x <= z.x + z.width && p.y >= z.y && p.y <= z.y + z.height)
      .sort((a, b) => a.width * a.height - b.width * b.height)[0] ?? null
  );
}

export type OfficePlace = { kind: "desk"; desk: string } | { kind: "zone"; zone: string } | { kind: "office" };

// Где человек в офисе словами: у своего места, в зоне или просто «в офисе».
// Без точки от датчика считаем, что он на своём месте.
export function officePlace(pos: { x: number; y: number } | null, desk: { code: string; x: number; y: number } | null, zones: ZoneRect[]): OfficePlace {
  const nearDesk = !pos || (desk !== null && Math.hypot(pos.x - desk.x, pos.y - desk.y) < 0.03);
  if (nearDesk && desk) return { kind: "desk", desk: desk.code };
  const zone = pos ? zoneAt(pos, zones) : null;
  return zone ? { kind: "zone", zone: zone.name } : { kind: "office" };
}

export const MAX_PLAN_BYTES = 5 * 1024 * 1024;

// Тип картинки по первым байтам, а не по имени файла. SVG не принимаем:
// в нём может быть скрипт.
export function sniffImageType(bytes: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

// Размер картинки в пикселях из заголовка файла (PNG, JPEG, WebP).
export function imageSize(bytes: Uint8Array, type: "image/png" | "image/jpeg" | "image/webp"): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  try {
    if (type === "image/png") return { width: view.getUint32(16), height: view.getUint32(20) };
    if (type === "image/webp") {
      const chunk = String.fromCharCode(...bytes.subarray(12, 16));
      if (chunk === "VP8 ") return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
      if (chunk === "VP8L") {
        const b = view.getUint32(21, true);
        return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
      }
      if (chunk === "VP8X") {
        const w = bytes[24] | (bytes[25] << 8) | (bytes[26] << 16);
        const h = bytes[27] | (bytes[28] << 8) | (bytes[29] << 16);
        return { width: w + 1, height: h + 1 };
      }
      return null;
    }
    // JPEG: ищем маркер SOFn
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) return null;
      const marker = bytes[i + 1];
      const len = view.getUint16(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: view.getUint16(i + 5), width: view.getUint16(i + 7) };
      }
      i += 2 + len;
    }
  } catch {
    return null;
  }
  return null;
}
