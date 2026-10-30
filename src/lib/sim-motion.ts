// Движение для программы-имитации (scripts/simulator.ts). Чистые функции — их легко проверить.

export type Pt = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };

// Шаг к цели не длиннее maxStep. arrived — дошли.
export function stepToward(from: Pt, to: Pt, maxStep: number): { pos: Pt; arrived: boolean } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= maxStep) return { pos: { ...to }, arrived: true };
  return { pos: { x: from.x + (dx / dist) * maxStep, y: from.y + (dy / dist) * maxStep }, arrived: false };
}

// Случайная точка внутри прямоугольника с отступом от краёв (доля размера).
export function randomInRect(r: Rect, rnd = Math.random, margin = 0.2): Pt {
  return {
    x: r.x + r.width * (margin + (1 - 2 * margin) * rnd()),
    y: r.y + r.height * (margin + (1 - 2 * margin) * rnd()),
  };
}

// Случайная точка в квадрате radius вокруг центра.
export function randomNear(c: Pt, radius: number, rnd = Math.random): Pt {
  return { x: c.x + (rnd() * 2 - 1) * radius, y: c.y + (rnd() * 2 - 1) * radius };
}
